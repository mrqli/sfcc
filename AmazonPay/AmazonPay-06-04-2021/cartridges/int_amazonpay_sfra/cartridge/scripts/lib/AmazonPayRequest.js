'use strict';

var URLUtils = require('dw/web/URLUtils');

var sitePreferences = require('dw/system/Site').getCurrent().getPreferences().getCustom();
var amzPayUtils = require('*/cartridge/scripts/util/amazonPayUtils');

/**
 *
 * @param {dw.order.Basket|dw.order.Order} basket The Basket class represents a shopping cart.
 * @param {httpMethod} httpMethod HTTP method
 * @param {String} url URL tha will be set on the request call
 * @param {srchVal} srchVal A value can search for and replace matches within a string.
 * @param {String} rplcVal A string containing the text to replace for every successful match of searchValue in this string.
 */
function AmazonPayRequest(basket, httpMethod, url, srchVal, rplcVal, amount) {
    this.amount = amount;
    this.basket = basket;
    this.captureNow = sitePreferences.amzCaptureNow;
    this.headers = [];
    this.httpMethod = httpMethod;
    this.idempotencyKey = this.httpMethod === 'POST' ? amzPayUtils.generateIdempotencyKey() : '';
    this.rplcVal = rplcVal || '';
    this.srchVal = srchVal || '';
    this.url = url || '';

    /**
     * Normalize URL received.
     * @param {String} url URL to be normalized
     */
    this.normalizeUrl = function normalizeUrl(url) { // eslint-disable-line no-shadow
        if (!url) {
            return;
        }

        var paramsToReplace = [];
        var newURL = url;

        paramsToReplace.push({ srchVal: ':region', rplcVal: sitePreferences.amzPayRegion.value });
        paramsToReplace.push({ srchVal: ':environment', rplcVal: sitePreferences.amzPayEnvironment.value });

        if (srchVal && rplcVal) {
            paramsToReplace.push({ srchVal: this.srchVal, rplcVal: this.rplcVal });
        }

        paramsToReplace.forEach(function (e) {
            newURL = newURL.replace(e.srchVal, e.rplcVal);
        });

        this.url = newURL;
    };
    /**
     * Generate headers to be added on the service headers.
     */
    this.generateHeaders = function generateHeaders() {
        var simulationCode = sitePreferences.amzPaySimulationCode ? sitePreferences.amzPaySimulationCode.split(':') : null;

        if (this.idempotencyKey) {
            this.headers.push({ entry: 'x-amz-pay-idempotency-key', val: this.idempotencyKey });
        }

        switch (this.srchVal) {
            case ':checkoutSessionId':
                if (this.httpMethod === 'GET' || this.httpMethod === 'DELETE') {
                    this.payload = '';
                } else if (this.httpMethod === 'PATCH') {
                    this.payload = {
                        webCheckoutDetail: {
                            checkoutReviewReturnUrl:
                                sitePreferences.amzPayCheckoutType.value === 'OneStepCheckout' ?
                                    URLUtils.https('AmazonPay-OneReview').toString() :
                                    URLUtils.https('AmazonPay-Review').toString(),
                            checkoutResultReturnUrl: URLUtils.https('AmazonPay-Result').toString()
                        },
                        paymentDetail: amzPayUtils.getPaymentDetail(this.basket)
                    };

                    if (simulationCode && simulationCode[0] === 'CheckoutSession') {
                        this.headers.push({ entry: 'x-amz-pay-simulation-code', val: simulationCode[1] });
                    }
                }
                break;
            case ':chargePermissionId':
                if (this.httpMethod === 'GET') {
                    this.payload = '';
                } else if (this.httpMethod === 'PATCH') {
                    this.payload = {
                        merchantMetadata: {
                            merchantReferenceId: this.basket.orderNo,
                            merchantStoreName: sitePreferences.amzPayMerchantName || '',
                            noteToBuyer: sitePreferences.amzPayNoteToBuyer || '',
                            customInformation: ''
                        }
                    };
                } else if (this.httpMethod === 'DELETE') {
                    this.payload = {
                        closureReason: 'No more charges required',
                        cancelPendingCharges: false
                    };

                    if (simulationCode && (simulationCode[0] === 'ChargePermission' || simulationCode[0] === 'Charge')) {
                        this.headers.push({ entry: 'x-amz-pay-simulation-code', val: simulationCode[1] });
                    }
                }
                break;
            case ':chargeId':
                if (this.httpMethod === 'GET') {
                    this.payload = '';
                } else if (this.httpMethod === 'DELETE') {
                    this.payload = {
                        cancellationReason: 'REASON DESCRIPTION' // change this to a value from BM
                    };
                } else {
                    this.payload = {
                        captureAmount: this.amount ? this.amount : amzPayUtils.getPaymentDetail(this.basket).chargeAmount,
                        softDescriptor: !empty(sitePreferences.amzPayCaptureDescriptor) ? sitePreferences.amzPayCaptureDescriptor.substr(0, 16) : null
                    };
                }
                if (simulationCode && simulationCode[0] === 'Charge') {
                    this.headers.push({ entry: 'x-amz-pay-simulation-code', val: simulationCode[1] });
                }
                break;
            case ':refundId':
                if (this.httpMethod === 'GET') {
                    this.payload = '';
                }
                break;
            default:
                if (this.url.indexOf('checkoutSession') !== -1) {
                    this.payload = {
                        webCheckoutDetail: {
                            checkoutReviewReturnUrl: sitePreferences.amzPayCheckoutType.value === 'OneStepCheckout' ?
                                URLUtils.https('AmazonPay-OneReview').toString() :
                                URLUtils.https('AmazonPay-Review').toString(),
                            checkoutResultReturnUrl: URLUtils.https('AmazonPay-Result').toString()
                        },
                        storeId: sitePreferences.amzPayStoreId,
                        paymentDetail: amzPayUtils.getPaymentDetail(this.basket)
                    };
                } else if (this.url.indexOf('charges') !== -1) {
                    if (this.captureNow) {
                        this.payload = {
                            chargePermissionId: this.rplcVal,
                            chargeAmount: this.amount ? this.amount : amzPayUtils.getPaymentDetail(this.basket).chargeAmount,
                            captureNow: this.captureNow, // default is false
                            softDescriptor: !empty(sitePreferences.amzPayCaptureDescriptor) ? sitePreferences.amzPayCaptureDescriptor.substr(0, 16) : null // Do not set this value if CaptureNow is set to false
                        };
                    } else {
                        this.payload = {
                            chargePermissionId: this.rplcVal,
                            chargeAmount: this.amount ? this.amount : amzPayUtils.getPaymentDetail(this.basket).chargeAmount,
                            captureNow: this.captureNow // default is false
                        };
                    }
                    if (simulationCode && simulationCode[0] === 'Charge') {
                        this.headers.push({ entry: 'x-amz-pay-simulation-code', val: simulationCode[1] });
                    }
                } else if (this.url.indexOf('refunds') !== -1) {
                    this.payload = {
                        chargeId: this.rplcVal, // change logic to set this value easily
                        refundAmount: this.amount ? this.amount : amzPayUtils.getPaymentDetail(this.basket).chargeAmount,
                        softDescriptor: !empty(sitePreferences.amzPayRefundDescriptor) ? sitePreferences.amzPayRefundDescriptor.substr(0, 16) : null
                    };
                }
                break;
        }

        this.payload = typeof this.payload === 'string' ? this.payload : JSON.stringify(this.payload);

        this.headers = amzPayUtils.generatePreSignedHeaders(this.headers);
        
        this.headers.push({ entry: 'authorization', val: amzPayUtils.generateAuthorizationHeader(this.httpMethod, this.url, this.payload, '', this.headers) });
        // dw.system.Logger.getLogger('AmazonPay', 'AmazonPayRequest').error(JSON.stringify(this.headers));
    };
}
AmazonPayRequest.prototype.type = 'AmazonPayRequest';

/**
 * @typedef {'POST'|'GET'|'PATCH'|'DELETE'} httpMethod
 */
/**
 * @typedef {':checkoutSessionId'|':chargePermissionId'|':chargeId'|':refundId'} srchVal
 */
module.exports = AmazonPayRequest;
