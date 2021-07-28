'use strict';

var server = require('server');

var Resource = require('dw/web/Resource');

var apn = require('*/cartridge/scripts/middleware/apn');

server.post('Notification', server.middleware.https, apn.validateRequest, function (req, res, next) {
    var OrderMgr = require('dw/order/OrderMgr');
    var Logger = require('dw/system/Logger');
    var Transaction = require('dw/system/Transaction');
    var Money = require('dw/value/Money');

    var sitePreferences = require('dw/system/Site').getCurrent().getPreferences().getCustom();

    var AmazonPayRequest = require('*/cartridge/scripts/lib/AmazonPayRequest');
    var ChargeService = require('*/cartridge/scripts/services/charge/amazonChargeService');
    var RefundService = require('*/cartridge/scripts/services/refund/amazonRefundService');

    var emailHelpers = require('*/cartridge/scripts/helpers/emailHelpers');
    var apnLogger = Logger.getLogger('APN', 'APN');

    var charge;
    var chargeRequest;
    var refund;
    var refundRequest;
    var result;
    var order;
    var subject;
    var text;
    var notification;
    var body;
    var emailObj;
    var code;

    try {
        body = JSON.parse(req.body);
    } catch (error) {
        res.setStatusCode(400);
        res.json({
            success: false,
            errorMessage: error.toString()
        });
        return next();
    }

    if (typeof body.Message === 'object') {
        notification = body.Message;
    } else {
        try {
            notification = JSON.parse(body.Message);
        } catch (error) {
            apnLogger.error(error.toString());
            res.setStatusCode(400);
            res.json({
                success: false,
                errorMessage: error.toString()
            });
            return next();
        }
    }

    switch (notification.ActionType) {
        case 'AUTHORIZE':
            // Search for order
            order = OrderMgr.searchOrder('custom.amzPayChargePermissionId={0}', notification.ChargePermissionId);

            if (!order) {
                apnLogger.error(Resource.msgf('error.message.notfound.order', 'amazon', null, 'ChargePermissionId', notification.ChargePermissionId));
                res.setStatusCode(404);
                res.json({
                    success: false,
                    errorMessage: Resource.msgf('error.message.notfound.order', 'amazon', null, 'ChargePermissionId', notification.ChargePermissionId)
                });
                return next();
            }

            var chargeAmount = null;

            if (notification.ChargeAmount) {
                chargeAmount = {
                    amount: notification.ChargeAmount.Amount,
                    currencyCode: notification.ChargeAmount.CurrencyCode
                };
            }

            chargeRequest = new AmazonPayRequest(order, 'POST', '', null, notification.ChargePermissionId, chargeAmount);
            result = ChargeService.create(chargeRequest);

            if (!result.ok) {
                code = result.getError();
                apnLogger.error(result.getErrorMessage());
                res.setStatusCode(code);
                res.json({
                    success: false,
                    message: JSON.parse(result.getErrorMessage()),
                    errorMessage: Resource.msg('error.message.service.error', 'amazon', null)
                });
                return next();
            }

            try {
                charge = JSON.parse(result.object);
            } catch (error) {
                res.setStatusCode(500);
                res.json({
                    success: false,
                    errorMessage: Resource.msgf('error.order.invalid.json.2', 'amazon', null, 'Charge')
                });
                return next();
            }

            if (charge.statusDetail.reasonCode) {
                subject = Resource.msgf('notes.subject.charge.1', 'amazon', null, charge.statusDetail.state, charge.statusDetail.reasonCode);
                text = Resource.msgf('charge.status.code.msg.' + charge.statusDetail.reasonCode, 'amazon', null, charge.chargeId);
            } else {
                subject = Resource.msgf('notes.subject.charge.2', 'amazon', null, charge.statusDetail.state);
                text = Resource.msgf('charge.status.code.msg.' + charge.statusDetail.state, 'amazon', null, charge.chargeId);
            }

            try {
                Transaction.wrap(function () {
                    order.addNote('APN | ' + subject, text);
                    order.custom.amzPayChargeId = charge.chargeId;
                    order.custom.amzPayChargeState = charge.statusDetail.state;
                    order.custom.amzPayChargeReasonCode = charge.statusDetail.reasonCode;
                });
            } catch (error) {
                res.setStatusCode(304);
                res.json({
                    success: false,
                    errorMessage: error.toString()
                });
                return next();
            }

            var authorizedAmount = new Money(Number(charge.chargeAmount.amount), charge.chargeAmount.currencyCode);

            var orderModel = {
                amount: authorizedAmount,
                chargePermissionId: order.custom.amzPayChargePermissionId,
                lastModified: order.getLastModified(),
                orderId: order.orderNo,
                state: order.custom.amzPayChargeState.displayValue
            };

            var orderObject = { order: orderModel };

            emailObj = {
                to: order.customerEmail,
                subject: Resource.msg('subject.order.authorization.email', 'amazon', null),
                from: sitePreferences.customerServiceEmail || 'no-reply@salesforce.com',
                type: emailHelpers.emailTypes.orderConfirmation
            };

            emailHelpers.sendEmail(emailObj, 'apn/authorizationEmail', orderObject);

            res.json({
                success: true,
                state: charge.statusDetail.state
            });
            return next();
        case 'CHARGE':
            // Search for order
            order = OrderMgr.searchOrder('custom.amzPayChargePermissionId={0}', notification.ChargePermissionId);

            if (!order) {
                apnLogger.error(Resource.msgf('error.message.notfound.order', 'amazon', null, 'ChargePermissionId', notification.ChargePermissionId));
                res.setStatusCode(404);
                res.json({
                    success: false,
                    errorMessage: Resource.msgf('error.message.notfound.order', 'amazon', null, 'ChargePermissionId', notification.ChargePermissionId)
                });
                return next();
            }

            var chargeAmount = null;

            if (notification.ChargeAmount) {
                chargeAmount = {
                    amount: notification.ChargeAmount.Amount,
                    currencyCode: notification.ChargeAmount.CurrencyCode
                };
            }

            chargeRequest = new AmazonPayRequest(order, 'POST', '', ':chargeId', order.custom.amzPayChargeId, chargeAmount);
            result = ChargeService.capture(chargeRequest);

            if (!result.ok) {
                code = result.getError();
                apnLogger.error(result.getErrorMessage());
                res.setStatusCode(code);
                res.json({
                    success: false,
                    errorMessage: JSON.parse(result.getErrorMessage())
                });
                return next();
            }

            try {
                charge = JSON.parse(result.object);
            } catch (error) {
                apnLogger.error(error.toString());
                res.setStatusCode(500);
                res.json({
                    success: false,
                    errorMessage: Resource.msgf('error.order.invalid.json.2', 'amazon', null, 'Charge')
                });
                return next();
            }

            if (charge.statusDetail.reasonCode) {
                subject = Resource.msgf('notes.subject.charge.1', 'amazon', null, charge.statusDetail.state, charge.statusDetail.reasonCode);
                text = Resource.msgf('charge.status.code.msg.' + charge.statusDetail.reasonCode, 'amazon', null, charge.chargeId);
            } else {
                subject = Resource.msgf('notes.subject.charge.2', 'amazon', null, charge.statusDetail.state);
                text = Resource.msgf('charge.status.code.msg.' + charge.statusDetail.state, 'amazon', null, charge.chargeId);
            }

            try {
                Transaction.wrap(function () {
                    order.addNote('APN | ' + subject, text);
                    order.custom.amzPayChargeId = charge.chargeId;
                    order.custom.amzPayChargeState = charge.statusDetail.state;
                    order.custom.amzPayChargeReasonCode = charge.statusDetail.reasonCode;
                });
            } catch (error) {
                apnLogger.error(error.toString());
                res.setStatusCode(304);
                res.json({
                    success: false,
                    errorMessage: error.toString()
                });
                return next();
            }


            var capturedAmount = new Money(Number(charge.chargeAmount.amount), charge.chargeAmount.currencyCode);

            var orderModel = {
                amount: capturedAmount,
                chargePermissionId: order.custom.amzPayChargePermissionId,
                lastModified: order.getLastModified(),
                orderId: order.orderNo,
                state: order.custom.amzPayChargeState.displayValue
            };

            var orderObject = { order: orderModel };

            emailObj = {
                to: order.customerEmail,
                subject: Resource.msg('subject.order.charge.email', 'amazon', null),
                from: sitePreferences.customerServiceEmail || 'no-reply@salesforce.com',
                type: emailHelpers.emailTypes.orderConfirmation
            };

            emailHelpers.sendEmail(emailObj, 'apn/chargeEmail', orderObject);

            res.json({
                success: true,
                state: charge.statusDetail.state
            });
            return next();
        case 'REFUND':
            // Search for order
            order = OrderMgr.searchOrder('custom.amzPayChargePermissionId={0}', notification.ChargePermissionId);

            if (!order) {
                apnLogger.error(Resource.msgf('error.message.notfound.order', 'amazon', null, 'ChargePermissionId', notification.ChargePermissionId));
                res.setStatusCode(404);
                res.json({
                    success: false,
                    errorMessage: Resource.msgf('error.message.notfound.order', 'amazon', null, 'ChargePermissionId', notification.ChargePermissionId)
                });
                return next();
            }

            var refundAmount = null;

            if (notification.RefundAmount) {
                refundAmount = {
                    amount: notification.ChargeAmount.Amount,
                    currencyCode: notification.ChargeAmount.CurrencyCode
                };
            }

            refundRequest = new AmazonPayRequest(order, 'POST', '', '', order.custom.amzPayChargeId, refundAmount);
            result = RefundService.create(refundRequest);

            if (!result.ok) {
                res.setStatusCode(500);
                res.json({
                    success: false,
                    message: JSON.parse(result.getErrorMessage()),
                    errorMessage: Resource.msg('error.message.service.error', 'amazon', null)
                });
                return next();
            }

            try {
                refund = JSON.parse(result.object);
            } catch (error) {
                apnLogger.error(error.toString());
                res.setStatusCode(500);
                res.json({
                    success: false,
                    errorMessage: Resource.msgf('error.order.invalid.json.2', 'amazon', null, 'Charge')
                });
                return next();
            }

            // Add the values to subject and text to add a new Note
            if (charge.statusDetail.reasonCode) {
                subject = Resource.msgf('notes.subject.charge.1', 'amazon', null, charge.statusDetail.state, charge.statusDetail.reasonCode);
                text = Resource.msgf('charge.status.code.msg.' + charge.statusDetail.reasonCode, 'amazon', null, charge.chargeId);
            } else {
                subject = Resource.msgf('notes.subject.charge.2', 'amazon', null, charge.statusDetail.state);
                text = Resource.msgf('charge.status.code.msg.' + charge.statusDetail.state, 'amazon', null, charge.chargeId);
            }

            try {
                Transaction.wrap(function () {
                    order.addNote('APN | ' + subject, text);
                    order.custom.amzPayRefundId = refund.refundId;
                    order.custom.amzPayRefundState = refund.statusDetail.state;
                    order.custom.amzPayRefundReasonCode = refund.statusDetail.reasonCode;
                });
            } catch (error) {
                apnLogger.error(error.toString());
                res.setStatusCode(304);
                res.json({
                    success: false,
                    errorMessage: error.toString()
                });
                return next();
            }

            var refundAmount = new Money(Number(refund.refundAmount.amount), charge.refundAmount.currencyCode);

            var orderModel = {
                amount: refundAmount,
                chargePermissionId: order.custom.amzPayChargePermissionId,
                lastModified: order.getLastModified(),
                orderId: order.orderNo,
                state: order.custom.amzPayChargeState.displayValue
            };

            var orderObject = { order: orderModel };

            emailObj = {
                to: order.customerEmail,
                subject: Resource.msg('subject.order.refund.email', 'amazon', null),
                from: sitePreferences.customerServiceEmail || 'no-reply@salesforce.com',
                type: emailHelpers.emailTypes.orderConfirmation
            };

            emailHelpers.sendEmail(emailObj, 'apn/refundEmail', orderObject);

            res.json({
                success: true,
                state: charge.statusDetail.state
            });
            return next();
        default:
            res.setStatusCode(400);
            res.json({
                success: false,
                errorMessage: Resource.msg('error.message.wrong.type', 'amazon', null)
            });
            return next();
    }
});

server.get('Fail', function (req, res, next) {
    var query = req.querystring;
    var errorMessage;
    if (query.reasonCode === '1') {
        errorMessage = Resource.msg('error.message.apn.error.1', 'amazon', null);
        res.setStatusCode(403);
    } else if (query.reasonCode === '2') {
        res.setStatusCode(401);
        errorMessage = Resource.msg('error.message.apn.error.2', 'amazon', null);
    }
    res.json({
        error: true,
        errorMessage: errorMessage
    });
    next();
});

module.exports = server.exports();
