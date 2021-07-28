'use strict';

var server = require('server');

var BasketMgr = require('dw/order/BasketMgr');
var Logger = require('dw/system/Logger');
var Transaction = require('dw/system/Transaction');
var URLUtils = require('dw/web/URLUtils');

var AmazonPayRequest = require('*/cartridge/scripts/lib/AmazonPayRequest');

var ChargePermissionService = require('*/cartridge/scripts/services/chargePermission/amazonChargePermissionService');
var ChargeService = require('*/cartridge/scripts/services/charge/amazonChargeService');
var CheckoutSessionService = require('*/cartridge/scripts/services/checkoutSession/amazonCheckoutSessionService');

var sitePreferences = require('dw/system/Site').getCurrent().getPreferences().getCustom();

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

function resRedirecter(res, msg) {
    res.redirect(URLUtils.url('Cart-Show', 'amzError', true, 'errorMessage', msg).toString());
}

server.post('CreateCheckoutSession', server.middleware.https, function (req, res, next) { // eslint-disable-line consistent-return
    var currentBasket = BasketMgr.getCurrentBasket();
    var amazonPayRequest;
    var checkoutSession;
    var result;

    if (!currentBasket) {
        res.redirect(URLUtils.url('Cart-Show').toString());
        return next();
    }

    if (!currentBasket.custom.amzPayCheckoutSessionId) {
        amazonPayRequest = new AmazonPayRequest(currentBasket, 'POST');
        result = CheckoutSessionService.create(amazonPayRequest);

        if (!result.ok) {
            resRedirecter(res, 'service.fail');

            return next();
        }

        try {
            checkoutSession = JSON.parse(result.object);
        } catch (error) {
            Logger.getLogger('AmazonPay', 'AmazonPay-CheckoutSession').error(error.toString());
            resRedirecter(res, 'service.fail');

            return next();
        }

        try {
            Transaction.wrap(function () {
                currentBasket.custom.amzPayCheckoutSessionId = checkoutSession.checkoutSessionId;
            });
        } catch (error) {
            resRedirecter(res, 'service.fail');

            return next();
        }

        res.json({
            checkoutSessionId: checkoutSession.checkoutSessionId
        });

        return next();
    }

    amazonPayRequest = new AmazonPayRequest(currentBasket, 'GET', '', ':checkoutSessionId', currentBasket.custom.amzPayCheckoutSessionId);
    result = CheckoutSessionService.get(amazonPayRequest);

    if (!result.ok) {
        resRedirecter(res, 'service.fail');

        return next();
    }

    try {
        checkoutSession = JSON.parse(result.object);
    } catch (error) {
        Logger.getLogger('AmazonPay', 'AmazonPay-CheckoutSession').error(error.toString());
        resRedirecter(res, 'service.fail');

        return next();
    }

    if (checkoutSession.statusDetail.state !== 'Open') {
        amazonPayRequest = new AmazonPayRequest(currentBasket, 'POST');
        result = CheckoutSessionService.create(amazonPayRequest);

        if (!result.ok) {
            resRedirecter(res, 'service.fail');

            return next();
        }

        try {
            checkoutSession = JSON.parse(result.object);
        } catch (error) {
            Logger.getLogger('AmazonPay', 'AmazonPay-CheckoutSession').error(error.toString());
            resRedirecter(res, 'service.fail');

            return next();
        }

        Transaction.wrap(function () {
            currentBasket.custom.amzPayCheckoutSessionId = checkoutSession.checkoutSessionId;
        });

        amazonPayRequest = new AmazonPayRequest(currentBasket, 'PATCH', '', ':checkoutSessionId', currentBasket.custom.amzPayCheckoutSessionId);
        result = CheckoutSessionService.update(amazonPayRequest);

        res.json({
            checkoutSessionId: checkoutSession.checkoutSessionId
        });
    } else {
        res.json({
            checkoutSessionId: checkoutSession.checkoutSessionId
        });
    }

    next();
});

server.get('GetCheckoutSession', server.middleware.https, function (req, res, next) {
    var currentBasket = BasketMgr.getCurrentBasket();

    res.json({
        checkoutSessionId: currentBasket.custom.amzPayCheckoutSessionId
    });

    return next();
});

server.get('Review', server.middleware.https, function (req, res, next) {
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');

    var currentBasket = BasketMgr.getCurrentBasket();


    if (!currentBasket) {
        resRedirecter(res, 'no.basket');

        return next();
    }

    var validatedProducts = validationHelpers.validateProducts(currentBasket);

    if (validatedProducts.error) {
        resRedirecter(res, 'no.basket');

        return next();
    }

    var viewData = {};
    var amazonCheckoutSessionId = req.querystring.amazonCheckoutSessionId;
    var amazonPayRequest = new AmazonPayRequest(currentBasket, 'GET', '', ':checkoutSessionId', amazonCheckoutSessionId);
    var result = CheckoutSessionService.get(amazonPayRequest);

    if (!result.ok) {
        resRedirecter(res, 'service.fail');

        return next();
    }

    try {
        var checkoutSession = JSON.parse(result.object);
    } catch (error) {
        Logger.getLogger('AmazonPay', 'AmazonPay-CheckoutSession').error(error.toString());
        resRedirecter(res, 'service.fail');

        return next();
    }

    var amzBillingAddress = !empty(checkoutSession.paymentPreferences[0].billingAddress) ? checkoutSession.paymentPreferences[0].billingAddress : null;
    var amzShippingAddress = checkoutSession.shippingAddress;
    var shipping = server.forms.getForm('shipping');
    var billing = server.forms.getForm('billing');

    shipping.clear();
    billing.clear();

    var names = amzShippingAddress.name.split(' ');
    var firstName = '';
    var lastName = '';

    names.forEach(function (n, i, a) {
        if (i === 0) {
            firstName = n;
        } else {
            lastName = lastName + n + (i + 1 < a.length ? ' ' : '');
        }
    });

    if (empty(lastName) && amzShippingAddress.countryCode !== 'JP') {
        lastName = '-';
    }
    
    var address1 = '';
    var address2 = '';

    if (empty(amzShippingAddress.addressLine1) && !empty(amzShippingAddress.addressLine2)) {
        address1 = amzShippingAddress.addressLine2;
        address2 = amzShippingAddress.addressLine2;
    } else {
        address1 = amzShippingAddress.addressLine1;
        address2 = amzShippingAddress.addressLine2;
    }

    address2 = !empty(amzShippingAddress.addressLine3) ? address2 + ' ' + amzShippingAddress.addressLine3 : address2;

    viewData.shippingAddress = {
        firstName: firstName,
        lastName: lastName,
        address1: address1,
        address2: address2,
        addressId: address1,
        countryCode: {
            value: amzShippingAddress.countryCode
        },
        postalCode: amzShippingAddress.postalCode,
        phone: amzShippingAddress.phoneNumber
    };

    var stateOrRegion = !empty(amzShippingAddress.stateOrRegion) ? amzShippingAddress.stateOrRegion : '';

    if (Object.prototype.hasOwnProperty.call(shipping.shippingAddress.addressFields, 'states')) {
        viewData.shippingAddress.stateCode = stateOrRegion;
    }

    if (Object.prototype.hasOwnProperty.call(shipping.shippingAddress.addressFields, 'city')) {
        viewData.shippingAddress.city = !empty(amzShippingAddress.city) ? amzShippingAddress.city : '';
    }

    // Billing Address
    if (amzBillingAddress) {
        var billingNames = amzBillingAddress.name.split(' ');
        var firstNameBilling = '';
        var lastNameBilling = '';

        billingNames.forEach(function (n, i, a) {
            if (i === 0) {
                firstNameBilling = n;
            } else {
                lastNameBilling = lastNameBilling + n + (i + 1 < a.length ? ' ' : '');
            }
        });

        if (empty(lastNameBilling) && amzBillingAddress.countryCode !== 'JP') {
            lastNameBilling = '-';
        }

        if (empty(amzBillingAddress.addressLine1) && !empty(amzBillingAddress.addressLine2)) {
            address1 = amzBillingAddress.addressLine2;
            address2 = amzBillingAddress.addressLine2;
        } else {
            address1 = amzBillingAddress.addressLine1;
            address2 = amzBillingAddress.addressLine2;
        }

        address2 = !empty(amzBillingAddress.addressLine3) ? address2 + ' ' + amzBillingAddress.addressLine3 : address2;

        viewData.billingAddress = {
            firstName: firstNameBilling,
            lastName: lastNameBilling,
            address1: address1,
            address2: address2,
            addressId: address1,
            city: amzBillingAddress.city,
            countryCode: {
                value: amzBillingAddress.countryCode
            },
            stateCode: amzBillingAddress.stateOrRegion,
            postalCode: amzBillingAddress.postalCode,
            phone: amzBillingAddress.phoneNumber || amzShippingAddress.phoneNumber
        };

        stateOrRegion = !empty(amzBillingAddress.stateOrRegion) ? amzBillingAddress.stateOrRegion : '';

        if (Object.prototype.hasOwnProperty.call(billing.addressFields, 'states')) {
            viewData.billingAddress.stateCode = stateOrRegion;
        }

        if (Object.prototype.hasOwnProperty.call(billing.addressFields, 'city')) {
            viewData.billingAddress.city = !empty(amzBillingAddress.city) ? amzBillingAddress.city : '';
        }

        shipping.shippingAddress.shippingAddressUseAsBillingAddress.value = false;
    } else {
        viewData.billingAddress = viewData.shippingAddress;
        shipping.shippingAddress.shippingAddressUseAsBillingAddress.value = true;
    }


    viewData.shippingMethod = shipping.shippingAddress.shippingMethodID.value
        ? shipping.shippingAddress.shippingMethodID.value.toString()
        : null;

    viewData.isGift = shipping.shippingAddress.isGift.checked;

    viewData.email = checkoutSession.buyer.email;

    viewData.giftMessage = viewData.isGift ? shipping.shippingAddress.giftMessage.value : null;

    req.session.privacyCache.set(currentBasket.defaultShipment.UUID, 'valid');

    res.setViewData(viewData);

    var shippingFormErrors = COHelpers.validateShippingForm(shipping.shippingAddress.addressFields);
    if (Object.keys(shippingFormErrors).length > 0) {
        req.session.privacyCache.set(currentBasket.defaultShipment.UUID, 'invalid');

        res.json({
            form: shipping,
            fieldErrors: [shippingFormErrors],
            serverErrors: [],
            error: true
        });
    } else {
        COHelpers.copyCustomerAddressToShipment(viewData.shippingAddress, currentBasket.defaultShipment);
        COHelpers.copyCustomerAddressToBilling(viewData.billingAddress);
        COHelpers.recalculateBasket(currentBasket);

        var giftResult = COHelpers.setGift(
            currentBasket.defaultShipment,
            viewData.isGift,
            viewData.giftMessage
        );

        if (giftResult.error) {
            res.json({
                error: giftResult.error,
                fieldErrors: [],
                serverErrors: [giftResult.errorMessage]
            });

            return next();
        }

        if (currentBasket.shipments.length <= 1) {
            req.session.privacyCache.set('usingMultiShipping', false);
        }

        COHelpers.recalculateBasket(currentBasket);

        Transaction.wrap(function () {
            currentBasket.custom.amzPayRedirectURL = checkoutSession.webCheckoutDetail.amazonPayRedirectUrl;
            currentBasket.setCustomerEmail(viewData.email);
        });

        var checkoutURL = URLUtils.url('Checkout-Begin', 'stage', 'shipping');
        res.redirect(checkoutURL);
        return next();
    }

    return next();
});

server.get('OneReview', server.middleware.https, function (req, res, next) {
    var CustomerMgr = require('dw/customer/CustomerMgr');
    var PaymentManager = require('dw/order/PaymentMgr');
    var HookMgr = require('dw/system/HookMgr');

    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
    var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');

    var currentBasket = BasketMgr.getCurrentBasket();

    if (!currentBasket) {
        resRedirecter(res, 'no.basket');

        return next();
    }

    var validatedProducts = validationHelpers.validateProducts(currentBasket);

    if (validatedProducts.error) {
        resRedirecter(res, 'no.basket');

        return next();
    }

    var amazonCheckoutSessionId = req.querystring.amazonCheckoutSessionId;
    var amazonPayRequest = new AmazonPayRequest(currentBasket, 'GET', '', ':checkoutSessionId', amazonCheckoutSessionId);
    var result = CheckoutSessionService.get(amazonPayRequest);

    if (!result.ok) {
        resRedirecter(res, 'service.fail');

        return next();
    }

    try {
        var checkoutSession = JSON.parse(result.object);
    } catch (error) {
        Logger.getLogger('AmazonPay', 'AmazonPay-CheckoutSession').error(error.toString());
        resRedirecter(res, 'invalid.json');
    }

    var amzBillingAddress = !empty(checkoutSession.paymentPreferences[0].billingAddress) ? checkoutSession.paymentPreferences[0].billingAddress : null;
    var amzShippingAddress = checkoutSession.shippingAddress;
    var shipping = server.forms.getForm('shipping');
    var billing = server.forms.getForm('billing');
    var names = amzShippingAddress.name.split(' ');
    var firstName = '';
    var lastName = '';
    var data = {
        email: checkoutSession.buyer.email
    };

    names.forEach(function (n, i, a) {
        if (i === 0) {
            firstName = n;
        } else {
            lastName = lastName + n + (i + 1 < a.length ? ' ' : '');
        }
    });

    if (empty(lastName) && amzShippingAddress.countryCode !== 'JP') {
        lastName = '-';
    }

    var address1 = '';
    var address2 = '';

    if (empty(amzShippingAddress.addressLine1) && !empty(amzShippingAddress.addressLine2)) {
        address1 = amzShippingAddress.addressLine2;
        address2 = amzShippingAddress.addressLine2;
    } else {
        address1 = amzShippingAddress.addressLine1;
        address2 = amzShippingAddress.addressLine2;
    }

    address2 = !empty(amzShippingAddress.addressLine3) ? address2 + ' ' + amzShippingAddress.addressLine3 : address2;

    data.shippingAddress = {
        firstName: firstName,
        lastName: lastName,
        address1: address1,
        address2: address2,
        addressId: address1,
        city: amzShippingAddress.city,
        countryCode: {
            value: amzShippingAddress.countryCode
        },
        stateCode: amzShippingAddress.stateOrRegion,
        postalCode: amzShippingAddress.postalCode,
        phone: amzShippingAddress.phoneNumber
    };

    // Create billing address from Amazon Pay if any
    if (amzBillingAddress) {
        var billingNames = amzBillingAddress.name.split(' ');
        var firstNameBilling = '';
        var lastNameBilling = '';

        billingNames.forEach(function (n, i, a) {
            if (i === 0) {
                firstNameBilling = n;
            } else {
                lastNameBilling = lastNameBilling + n + (i + 1 < a.length ? ' ' : '');
            }
        });

        if (empty(lastNameBilling) && amzBillingAddress.countryCode !== 'JP') {
            lastNameBilling = '-';
        }

        if (empty(amzBillingAddress.addressLine1) && !empty(amzBillingAddress.addressLine2)) {
            address1 = amzBillingAddress.addressLine2;
            address2 = amzBillingAddress.addressLine2;
        } else {
            address1 = amzBillingAddress.addressLine1;
            address2 = amzBillingAddress.addressLine2;
        }

        address2 = !empty(amzBillingAddress.addressLine3) ? address2 + ' ' + amzBillingAddress.addressLine3 : address2;

        data.billingAddress = {
            firstName: firstNameBilling,
            lastName: lastNameBilling,
            address1: address1,
            address2: address2,
            addressId: address1,
            city: amzBillingAddress.city,
            countryCode: {
                value: amzBillingAddress.countryCode
            },
            stateCode: amzBillingAddress.stateOrRegion,
            postalCode: amzBillingAddress.postalCode,
            phone: amzBillingAddress.phoneNumber || amzShippingAddress.phoneNumber
        };
    } else {
        data.billingAddress = data.shippingAddress;
    }

    var customer = CustomerMgr.getCustomerByLogin(checkoutSession.buyer.email);
    if (customer) {
        var customerProfile = customer.getProfile();

        try {
            Transaction.wrap(function () {
                customerProfile.custom.amzPayBuyerId = checkoutSession.buyer.buyerId;
            });
        } catch (error) {
            Logger.error(error.toString());
        }
    }

    req.session.privacyCache.set('usingMultiShipping', false);

    // Create Shipping and Billing Address
    COHelpers.copyCustomerAddressToShipment(data.shippingAddress, currentBasket.defaultShipment);
    COHelpers.copyCustomerAddressToBilling(data.billingAddress);
    COHelpers.recalculateBasket(currentBasket);

    Transaction.wrap(function () {
        currentBasket.setCustomerEmail(data.email);
    });

    var paymentProcessor = PaymentManager.getPaymentMethod('AMAZON_PAY').getPaymentProcessor();

    var paymentFormResult;
    if (HookMgr.hasHook('app.payment.form.processor.' + paymentProcessor.ID.toLowerCase())) {
        paymentFormResult = HookMgr.callHook('app.payment.form.processor.' + paymentProcessor.ID.toLowerCase(),
            'processForm',
            req,
            billing,
            data.billingAddress
        );
    } else {
        paymentFormResult = HookMgr.callHook('app.payment.form.processor.default_form_processor', 'processForm');
    }

    // use paymentFormResult to return something
    if (HookMgr.hasHook('app.payment.processor.' + paymentProcessor.ID.toLowerCase())) {
        result = HookMgr.callHook('app.payment.processor.' + paymentProcessor.ID.toLowerCase(),
            'Handle',
            currentBasket,
            data.paymentInformation
        );
    } else {
        result = HookMgr.callHook('app.payment.processor.default', 'Handle');
    }

    // Calculate the basket
    Transaction.wrap(function () {
        basketCalculationHelpers.calculateTotals(currentBasket);
    });

    // Re-calculate the payments.
    var calculatedPaymentTransaction = COHelpers.calculatePaymentTransaction(currentBasket);

    try {
        Transaction.wrap(function () {
            currentBasket.custom.amzPayRedirectURL = checkoutSession.webCheckoutDetail.amazonPayRedirectUrl;
        });
    } catch (error) {
        Logger.getLogger('AmazonPay', 'AmazonPay-CheckoutSession').error(error.toString());
    }

    res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'placeOrder'));

    return next();
});

server.get('Result', server.middleware.https, function (req, res, next) {
    var OrderMgr = require('dw/order/OrderMgr');
    var Resource = require('dw/web/Resource');
    var ArrayList = require('dw/util/ArrayList');
    var CustomerMgr = require('dw/customer/CustomerMgr');

    var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
    var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');

    var currentBasket = BasketMgr.getCurrentBasket();
    var subject;
    var text;

    if (!currentBasket) {
        res.redirect(URLUtils.url('Cart-Show', 'error', true, 'cartError', true).toString());

        return next();
    }

    var validatedProducts = validationHelpers.validateProducts(currentBasket);

    if (validatedProducts.error) {
        res.redirect(URLUtils.url('Cart-Show', 'error', true, 'cartError', true).toString());

        return next();
    }

    var customer;

    if (currentBasket.getCustomerEmail()) {
        customer = CustomerMgr.getCustomerByLogin(currentBasket.getCustomerEmail());
    }

    if (req.session.privacyCache.get('fraudDetectionStatus')) {
        res.redirect(URLUtils.url('Error-ErrorCode', 'err', '01').toString());
        return next();
    }

    var validationOrderStatus = hooksHelper('app.validate.order', 'validateOrder', currentBasket, require('*/cartridge/scripts/hooks/validateOrder').validateOrder);

    if (validationOrderStatus.error) {
        Logger.getLogger('AmazonPay', 'Result').error('Error while trying to validate the Order: {0}', validationOrderStatus.message);
        resRedirecter(res, 'technical');
        return next();
    }

    // Calculate the basket
    Transaction.wrap(function () {
        basketCalculationHelpers.calculateTotals(currentBasket);
    });

    // Re-validates existing payment instruments
    var validPayment = COHelpers.validatePayment(req, currentBasket);
    if (validPayment.error) {
        resRedirecter(res, 'payment.not.valid');
        return next();
    }

    // Re-calculate the payments.
    var calculatedPaymentTransactionTotal = COHelpers.calculatePaymentTransaction(currentBasket);
    if (calculatedPaymentTransactionTotal.error) {
        Logger.getLogger('AmazonPay', 'Result').error('Error while calculating payment transaction {0}', calculatedPaymentTransactionTotal.error);
        resRedirecter(res, 'technical');
        return next();
    }

    var amazonCheckoutSessionId = req.querystring.amazonCheckoutSessionId;
    var amazonPayRequest = new AmazonPayRequest(currentBasket, 'GET', '', ':checkoutSessionId', amazonCheckoutSessionId);
    var result = CheckoutSessionService.get(amazonPayRequest);

    if (!result.ok) {
        resRedirecter(res, 'service.fail');

        return next();
    }

    try {
        var checkoutSession = JSON.parse(result.object);
    } catch (error) {
        Logger.getLogger('AmazonPay', 'AmazonPay-CheckoutSession').error(error.toString());
        resRedirecter(res, 'invalid.json');

        return next();
    }

    Transaction.wrap(function () {
        currentBasket.custom.amzPayChargeId = checkoutSession.chargeId;
        currentBasket.custom.amzPayChargePermissionId = checkoutSession.chargePermissionId;
        currentBasket.custom.amzPayCheckoutSessionState = checkoutSession.statusDetail.state;
        currentBasket.custom.amzPayCheckoutSessionReasonCode = checkoutSession.statusDetail.reasonCode;
        currentBasket.custom.amzPayRedirectURL = null;
    });

    if (checkoutSession.statusDetail.state === 'Completed') {
        // Creates a new order.
        var order = COHelpers.createOrder(currentBasket);
        if (!order) {
            Logger.getLogger('AmazonPay', 'Result').error('Error while trying to create the Order');
            resRedirecter(res, 'technical');

            return next();
        }

        // Handles payment authorization
        var handlePaymentResult = COHelpers.handlePayments(order, order.orderNo);
        if (handlePaymentResult.error) {
            Logger.getLogger('AmazonPay', 'Result').error('Error while trying to handle payments used in the Order');
            resRedirecter(res, 'technical');

            return next();
        }

        var fraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', currentBasket, require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection);
        if (fraudDetectionStatus.status === 'fail') {
            Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

            // fraud detection failed
            req.session.privacyCache.set('fraudDetectionStatus', true);

            res.redirect(URLUtils.url('Error-ErrorCode', 'err', fraudDetectionStatus.errorCode).toString());

            return next();
        }

        if (customer) {
            Transaction.wrap(function () {
                order.setCustomer(customer);
            });
        }

        amazonPayRequest = new AmazonPayRequest(order, 'PATCH', '', ':chargePermissionId', checkoutSession.chargePermissionId);
        result = ChargePermissionService.update(amazonPayRequest);

        if (!result.ok) {
            resRedirecter(res, 'service.fail');

            return next();
        }

        try {
            var chargePermission = JSON.parse(result.object);
        } catch (error) {
            Logger.getLogger('AmazonPay', 'AmazonPay-ChargePermission').error(error.toString());
            resRedirecter(res, 'invalid.json');

            return next();
        }

        subject = Resource.msgf('notes.subject.chargepermission.2', 'amazon', null, chargePermission.statusDetail.state);
        text = Resource.msgf('chargepermission.status.code.msg.' + chargePermission.statusDetail.state, 'amazon', null, chargePermission.chargePermissionId);

        Transaction.wrap(function () {
            if (chargePermission.statusDetail.reasons) {
                var reasonCodes = new ArrayList(order.custom.amzPayChargePermissionReasonCode);
                chargePermission.statusDetail.reasons.forEach(function (e) {
                    reasonCodes.push(e.reasonCode);
                    var chargePermissionSubject = Resource.msgf('notes.subject.chargepermission.1', 'amazon', null, chargePermission.statusDetail.state, e.reasonCode);
                    var chargePermissionText = Resource.msgf('chargepermission.status.code.msg.' + e.reasonCode, 'amazon', null, chargePermission.chargePermissionId);
                    order.addNote(chargePermissionSubject, chargePermissionText);
                });
                order.custom.amzPayChargePermissionReasonCode = reasonCodes.toArray();
            }

            order.addNote(subject, text);
            order.custom.amzPayChargePermissionState = chargePermission.statusDetail.state;
        });

        // If the payment intent is confirm there is no chargeId on checkoutSession object
        if (sitePreferences.amzPayPaymentIntent.value !== 'Confirm') {
            // GET the Charge object and update the order details
            amazonPayRequest = new AmazonPayRequest('', 'GET', '', ':chargeId', checkoutSession.chargeId);
            result = ChargeService.get(amazonPayRequest);

            if (!result.ok) {
                resRedirecter(res, 'service.fail');
                return next();
            }

            try {
                var charge = JSON.parse(result.object);
            } catch (error) {
                Logger.getLogger('AmazonPay', 'AmazonPay-Charge').error(error.toString());
                resRedirecter(res, 'invalid.json');
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
                    order.addNote(subject, text);
                    order.custom.amzPayChargeState = charge.statusDetail.state;
                    order.custom.amzPayChargeReasonCode = charge.statusDetail.reasonCode;
                });
            } catch (error) {
                Logger.error(error.toString());
            }
        }

        if (sitePreferences.amzPayPaymentIntent.value === 'AuthorizeWithCapture' && charge.statusDetail.state === 'Authorized') {
            // Capture Charge
            amazonPayRequest = new AmazonPayRequest(currentBasket, 'POST', '', ':chargeId', checkoutSession.chargeId);
            result = ChargeService.capture(amazonPayRequest);

            if (!result.ok) {
                // Merchant should try again the attempt to create the charge
                resRedirecter(res, 'service.fail');
                return next();
            }

            try {
                charge = JSON.parse(result.object);
            } catch (error) {
                Logger.getLogger('AmazonPay', 'AmazonPay-Charge').error(error.toString());
                resRedirecter(res, 'invalid.json');
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
                    order.addNote(subject, text);
                    order.custom.amzPayChargeState = charge.statusDetail.state;
                    order.custom.amzPayChargeReasonCode = charge.statusDetail.reasonCode;
                });
            } catch (error) {
                Logger.getLogger('AmazonPay', 'Result').error('ERROR! Another transaction was in progress causing the fail of update for Order with the new Charge State and Charge Reason Code');
                resRedirecter(res, 'technical');
            }
        }

        var chargeState = charge ? charge.statusDetail.state : null;

        if (chargeState
            && (
                chargeState === 'AuthorizationInitiated' ||
                chargeState === 'Authorized' ||
                chargeState === 'CaptureInitiated' ||
                chargeState === 'Captured'
            )
        ) {
            // Places the order
            var placeOrderResult = COHelpers.placeOrder(order, fraudDetectionStatus);
            if (placeOrderResult.error) {
                Logger.getLogger('AmazonPay', 'Result').error('Error while trying to place Order');
                resRedirecter(res, 'technical');
                return next();
            }

            COHelpers.sendConfirmationEmail(order, req.locale.id);

            res.redirect(URLUtils.url('Order-Confirm', 'ID', order.orderNo, 'error', false, 'token', order.orderToken));

            return next();
        } else if (chargeState && charge.statusDetail.state === 'Declined') {
            // fail order
            Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

            // After fail order clean up currentBasket
            var notes = currentBasket.getNotes().iterator();

            while (notes.hasNext()) {
                var note = note.next();
                currentBasket.removeNote(note);
            }

            resRedirecter(res, 'payment.decline');

            return next();
        } else {
            // Places the order
            var placeOrderResult = COHelpers.placeOrder(order, fraudDetectionStatus);
            if (placeOrderResult.error) {
                resRedirecter(res, 'technical');
                return next();
            }
            amazonPayRequest = new AmazonPayRequest(order, 'PATCH', '', ':chargePermissionId', checkoutSession.chargePermissionId);
            result = ChargePermissionService.update(amazonPayRequest);

            if (!result.ok) {
                resRedirecter(res, 'service.fail');

                return next();
            }

            COHelpers.sendConfirmationEmail(order, req.locale.id);

            res.redirect(URLUtils.url('Order-Confirm', 'ID', order.orderNo, 'error', false, 'token', order.orderToken));

            return next();
        }
    } else if (checkoutSession.statusDetail.state === 'Canceled') {
        if (checkoutSession.statusDetail.reasonCode === 'Declined') {
            // Creates a new order.
            var order = COHelpers.createOrder(currentBasket);
            if (!order) {
                Logger.getLogger('AmazonPay', 'Result').error('Error while trying to create the Order');
                resRedirecter(res, 'technical');

                return next();
            }

            // Handles payment authorization
            var handlePaymentResult = COHelpers.handlePayments(order, order.orderNo);
            if (handlePaymentResult.error) {
                Logger.getLogger('AmazonPay', 'Result').error('Error while trying to handle payments used in the Order');
                resRedirecter(res, 'technical');

                return next();
            }

            var fraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', currentBasket, require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection);
            if (fraudDetectionStatus.status === 'fail') {
                Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

                // fraud detection failed
                req.session.privacyCache.set('fraudDetectionStatus', true);

                res.redirect(URLUtils.url('Error-ErrorCode', 'err', fraudDetectionStatus.errorCode).toString());

                return next();
            }

            if (customer) {
                Transaction.wrap(function () {
                    order.setCustomer(customer);
                });
            }

            Transaction.wrap(function () {
                OrderMgr.failOrder(order, true);
                order.addNote(checkoutSession.statusDetail.reasonCode, checkoutSession.statusDetail.reasonDescription);
                var notes = currentBasket.getNotes().iterator();
                while (notes.hasNext()) {
                    var note = note.next();
                    currentBasket.removeNote(note);
                }
            });

            resRedirecter(res, 'payment.decline');

            return next();
        } else {
            res.redirect(URLUtils.url('Cart-Show').toString());
            return next();
        }
    }

    return next();
});

server.post(
    'SubmitPayment',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var PaymentManager = require('dw/order/PaymentMgr');
        var HookManager = require('dw/system/HookMgr');
        var Resource = require('dw/web/Resource');

        var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');

        var viewData = {};
        var paymentForm = server.forms.getForm('billing');
        var currentBasket = BasketMgr.getCurrentBasket();

        // Handling Amazon Pay Checkout
        if (currentBasket.custom.amzPayRedirectURL !== null) {
            var checkoutSessionId = currentBasket.custom.amzPayCheckoutSessionId;
            var amazonPayRequest = new AmazonPayRequest('', 'GET', '', ':checkoutSessionId', checkoutSessionId);
            var result = CheckoutSessionService.get(amazonPayRequest);
            var checkoutSession = JSON.parse(result.object);
            if (checkoutSession.statusDetail.state !== 'Open') {
                Transaction.wrap(function () {
                    currentBasket.custom.amzPayCheckoutSessionId = null;
                    currentBasket.custom.amzPayRedirectURL = null;
                });
                checkoutSessionId = null;
            } else {
                paymentForm.paymentMethod.value = 'AMAZON_PAY';
            }
        }

        // verify billing form data
        var billingFormErrors = COHelpers.validateBillingForm(paymentForm.addressFields);
        var contactInfoFormErrors = COHelpers.validateFields(paymentForm.contactInfoFields);

        var formFieldErrors = [];
        if (Object.keys(billingFormErrors).length) {
            formFieldErrors.push(billingFormErrors);
        } else {
            viewData.address = {
                firstName: { value: paymentForm.addressFields.firstName.value },
                lastName: { value: paymentForm.addressFields.lastName.value },
                address1: { value: paymentForm.addressFields.address1.value },
                address2: { value: paymentForm.addressFields.address2.value },
                city: { value: paymentForm.addressFields.city.value },
                postalCode: { value: paymentForm.addressFields.postalCode.value },
                countryCode: { value: paymentForm.addressFields.country.value }
            };

            if (Object.prototype.hasOwnProperty.call(paymentForm.addressFields, 'states')) {
                viewData.address.stateCode = { value: paymentForm.addressFields.states.stateCode.value };
            }
        }

        if (Object.keys(contactInfoFormErrors).length) {
            formFieldErrors.push(contactInfoFormErrors);
        } else {
            viewData.email = {
                value: paymentForm.contactInfoFields.email.value
            };

            viewData.phone = { value: paymentForm.contactInfoFields.phone.value };
        }

        var paymentMethodIdValue = paymentForm.paymentMethod.value;
        if (!PaymentManager.getPaymentMethod(paymentMethodIdValue).paymentProcessor) {
            throw new Error(Resource.msg(
                'error.payment.processor.missing',
                'checkout',
                null
            ));
        }

        var paymentProcessor = PaymentManager.getPaymentMethod(paymentMethodIdValue).getPaymentProcessor();

        var paymentFormResult;
        if (HookManager.hasHook('app.payment.form.processor.' + paymentProcessor.ID.toLowerCase())) {
            paymentFormResult = HookManager.callHook('app.payment.form.processor.' + paymentProcessor.ID.toLowerCase(),
                'processForm',
                req,
                paymentForm,
                viewData
            );
        } else {
            paymentFormResult = HookManager.callHook('app.payment.form.processor.default_form_processor', 'processForm');
        }

        if (paymentFormResult.error && paymentFormResult.fieldErrors) {
            formFieldErrors.push(paymentFormResult.fieldErrors);
        }

        if (formFieldErrors.length || paymentFormResult.serverErrors) {
            // respond with form data and errors
            res.json({
                form: paymentForm,
                fieldErrors: formFieldErrors,
                serverErrors: paymentFormResult.serverErrors ? paymentFormResult.serverErrors : [],
                error: true
            });
            return next();
        }

        res.setViewData(paymentFormResult.viewData);

        this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
            var HookMgr = require('dw/system/HookMgr');
            var PaymentMgr = require('dw/order/PaymentMgr');
            var PaymentInstrument = require('dw/order/PaymentInstrument');
            var AccountModel = require('*/cartridge/models/account');
            var OrderModel = require('*/cartridge/models/order');
            var Locale = require('dw/util/Locale');
            var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
            var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
            var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');

            currentBasket = BasketMgr.getCurrentOrNewBasket();
            var validatedProducts = validationHelpers.validateProducts(currentBasket);

            var billingData = res.getViewData();

            if (!currentBasket || validatedProducts.error) {
                delete billingData.paymentInformation;

                res.json({
                    error: true,
                    cartError: true,
                    fieldErrors: [],
                    serverErrors: [],
                    redirectUrl: URLUtils.url('Cart-Show').toString()
                });
                return;
            }

            var billingAddress = currentBasket.billingAddress;
            var billingForm = server.forms.getForm('billing');
            var paymentMethodID = billingData.paymentMethod.value;
            var result;

            billingForm.creditCardFields.cardNumber.htmlValue = '';
            billingForm.creditCardFields.securityCode.htmlValue = '';

            Transaction.wrap(function () {
                if (!billingAddress) {
                    billingAddress = currentBasket.createBillingAddress();
                }

                billingAddress.setFirstName(billingData.address.firstName.value);
                billingAddress.setLastName(billingData.address.lastName.value);
                billingAddress.setAddress1(billingData.address.address1.value);
                billingAddress.setAddress2(billingData.address.address2.value);
                billingAddress.setCity(billingData.address.city.value);
                billingAddress.setPostalCode(billingData.address.postalCode.value);
                if (Object.prototype.hasOwnProperty.call(billingData.address, 'stateCode')) {
                    billingAddress.setStateCode(billingData.address.stateCode.value);
                }
                billingAddress.setCountryCode(billingData.address.countryCode.value);

                if (billingData.storedPaymentUUID) {
                    billingAddress.setPhone(req.currentCustomer.profile.phone);
                    currentBasket.setCustomerEmail(req.currentCustomer.profile.email);
                } else {
                    billingAddress.setPhone(billingData.phone.value);
                    currentBasket.setCustomerEmail(billingData.email.value);
                }
            });

            // if there is no selected payment option and balance is greater than zero
            if (!paymentMethodID && currentBasket.totalGrossPrice.value > 0) {
                var noPaymentMethod = {};

                noPaymentMethod[billingData.paymentMethod.htmlName] =
                    Resource.msg('error.no.selected.payment.method', 'payment', null);

                delete billingData.paymentInformation;

                res.json({
                    form: billingForm,
                    fieldErrors: [noPaymentMethod],
                    serverErrors: [],
                    error: true
                });
                return;
            }

            if (PaymentInstrument.METHOD_CREDIT_CARD === paymentMethodID) {
                // Validate payment instrument
                var creditCardPaymentMethod = PaymentMgr.getPaymentMethod(PaymentInstrument.METHOD_CREDIT_CARD);
                var paymentCard = PaymentMgr.getPaymentCard(billingData.paymentInformation.cardType.value);

                var applicablePaymentCards = creditCardPaymentMethod.getApplicablePaymentCards(
                    req.currentCustomer.raw,
                    req.geolocation.countryCode,
                    null
                );

                if (!applicablePaymentCards.contains(paymentCard)) {
                    // Invalid Payment Instrument
                    var invalidPaymentMethod = Resource.msg('error.payment.not.valid', 'checkout', null);
                    delete billingData.paymentInformation;
                    res.json({
                        form: billingForm,
                        fieldErrors: [],
                        serverErrors: [invalidPaymentMethod],
                        error: true
                    });
                    return;
                }
            }

            // check to make sure there is a payment processor
            if (!PaymentMgr.getPaymentMethod(paymentMethodID).paymentProcessor) {
                throw new Error(Resource.msg(
                    'error.payment.processor.missing',
                    'checkout',
                    null
                ));
            }

            var processor = PaymentMgr.getPaymentMethod(paymentMethodID).getPaymentProcessor();

            if (HookMgr.hasHook('app.payment.processor.' + processor.ID.toLowerCase())) {
                result = HookMgr.callHook('app.payment.processor.' + processor.ID.toLowerCase(),
                    'Handle',
                    currentBasket,
                    billingData.paymentInformation
                );
            } else {
                result = HookMgr.callHook('app.payment.processor.default', 'Handle');
            }

            // need to invalidate credit card fields
            if (result.error) {
                delete billingData.paymentInformation;

                res.json({
                    form: billingForm,
                    fieldErrors: result.fieldErrors,
                    serverErrors: result.serverErrors,
                    error: true
                });
                return;
            }

            if (HookMgr.hasHook('app.payment.form.processor.' + processor.ID.toLowerCase())) {
                HookMgr.callHook('app.payment.form.processor.' + processor.ID.toLowerCase(),
                    'savePaymentInformation',
                    req,
                    currentBasket,
                    billingData
                );
            } else {
                HookMgr.callHook('app.payment.form.processor.default', 'savePaymentInformation');
            }

            // Calculate the basket
            Transaction.wrap(function () {
                basketCalculationHelpers.calculateTotals(currentBasket);
            });

            // Re-calculate the payments.
            var calculatedPaymentTransaction = COHelpers.calculatePaymentTransaction(
                currentBasket
            );

            if (calculatedPaymentTransaction.error) {
                res.json({
                    form: paymentForm,
                    fieldErrors: [],
                    serverErrors: [Resource.msg('error.technical', 'checkout', null)],
                    error: true
                });
                return;
            }

            var usingMultiShipping = req.session.privacyCache.get('usingMultiShipping');
            if (usingMultiShipping === true && currentBasket.shipments.length < 2) {
                req.session.privacyCache.set('usingMultiShipping', false);
                usingMultiShipping = false;
            }

            hooksHelper('app.customer.subscription', 'subscribeTo', [paymentForm.subscribe.checked, paymentForm.contactInfoFields.email.htmlValue], function () {});

            var currentLocale = Locale.getLocale(req.locale.id);

            var basketModel = new OrderModel(
                currentBasket,
                { usingMultiShipping: usingMultiShipping, countryCode: currentLocale.country, containerView: 'basket' }
            );

            var accountModel = new AccountModel(req.currentCustomer);
            var renderedStoredPaymentInstrument = COHelpers.getRenderedPaymentInstruments(
                req,
                accountModel
            );

            delete billingData.paymentInformation;

            res.json({
                renderedPaymentInstruments: renderedStoredPaymentInstrument,
                customer: accountModel,
                order: basketModel,
                form: billingForm,
                error: false
            });
        });

        return next();
    }
);
module.exports = server.exports();
