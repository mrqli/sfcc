'use strict';

var baseBilling = require('base/checkout/billing');

baseBilling.methods.updatePaymentInformation = function updatePaymentInformation(order) {
    var $paymentSummary = $('.payment-details');
    var htmlToAppend = '';

    if (order.billing.payment && order.billing.payment.selectedPaymentInstruments && order.billing.payment.selectedPaymentInstruments.length > 0) {
        order.billing.payment.selectedPaymentInstruments.forEach(function (pi) {
            if (pi.paymentMethod === 'CREDIT_CARD') {
                htmlToAppend += '<span>' + order.resources.cardType + ' '
                    + pi.type
                    + '</span><div>'
                    + pi.maskedCreditCardNumber
                    + '</div><div><span>'
                    + order.resources.cardEnding + ' '
                    + pi.expirationMonth
                    + '/' + pi.expirationYear
                    + '</span></div>';
            } else if (pi.paymentMethod === 'AMAZON_PAY' && $('.amazon-pay-tab .amazon-pay-option').length) {
                htmlToAppend += '<div class="amazon-pay-option">'
                + '<span>' + pi.paymentDescriptor + '</span>'
                + ' <span class="change-payment">' + pi.paymentEdit + '</span>'
                + '</div>';
            }
        });
    }

    $paymentSummary.empty().append(htmlToAppend);

    if (order.billing.payment && order.billing.payment.selectedPaymentInstruments && order.billing.payment.selectedPaymentInstruments.length > 0) {
        order.billing.payment.selectedPaymentInstruments.forEach(function (pi) {
            if (pi.paymentMethod === 'AMAZON_PAY' && $('.amazon-pay-tab .amazon-pay-option').length) {
                if ($('.change-payment').length) {
                    amazon.Pay.bindChangeAction('.change-payment', {
                    amazonCheckoutSessionId: order.amzPayCheckoutSessionId,
                    changeAction: 'changePayment'
                });
            }
            }
        });
    }
};

module.exports = baseBilling;
