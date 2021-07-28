'use strict';

var $ = require('jquery');

$(document).ready( function() {
    var amazonPaymentsObject = {
        addButtonToCheckoutPage: function () {
            if ($('#AmazonPayButtonCheckout').length) {
                // eslint-disable-next-line
                amazon.Pay.renderButton('#AmazonPayButtonCheckout', {
                    merchantId: AmazonSitePreferences.AMAZON_MERCHANT_ID,
                    createCheckoutSession: {
                        url: AmazonURLs.createCheckoutSession
                    },
                    ledgerCurrency: AmazonSitePreferences.AMAZON_CURRENCY,
                    checkoutLanguage: AmazonSitePreferences.AMAZON_CHECKOUT_LANGUAGE,
                    productType: AmazonSitePreferences.AMAZON_PRODUCT_TYPE,
                    sandbox: AmazonSitePreferences.AMAZON_SANDBOX_MODE,
                    placement: 'Checkout'
                });
            }
        },
        addButtonToCartPage: function () {
            if ($('#AmazonPayButtonCart').length) {
                // eslint-disable-next-line
                amazon.Pay.renderButton('#AmazonPayButtonCart', {
                    merchantId: AmazonSitePreferences.AMAZON_MERCHANT_ID,
                    createCheckoutSession: {
                        url: AmazonURLs.createCheckoutSession
                    },
                    ledgerCurrency: AmazonSitePreferences.AMAZON_CURRENCY,
                    checkoutLanguage: AmazonSitePreferences.AMAZON_CHECKOUT_LANGUAGE,
                    productType: AmazonSitePreferences.AMAZON_PRODUCT_TYPE,
                    sandbox: AmazonSitePreferences.AMAZON_SANDBOX_MODE,
                    placement: 'Cart'
                });
            }
        },
        initiateBindChangeActions: function () {
            if ($('.edit-shipping').length || $('.change-payment').length || $('.edit-shipping-first').length) {
                $.ajax({
                    url: AmazonURLs.getCheckoutSession,
                    type: 'GET',
                    success: function (data) {
                        if ($('.edit-shipping').length) {
                            // eslint-disable-next-line
                            amazon.Pay.bindChangeAction('.edit-shipping', {
                                amazonCheckoutSessionId: data.checkoutSessionId,
                                changeAction: 'changeAddress'
                            });
                        }
                        if ($('.edit-shipping-first').length) {
                            // eslint-disable-next-line
                            amazon.Pay.bindChangeAction('.edit-shipping-first', {
                                amazonCheckoutSessionId: data.checkoutSessionId,
                                changeAction: 'changeAddress'
                            });
                        }
                        if ($('.change-payment').length) {
                            // eslint-disable-next-line
                            amazon.Pay.bindChangeAction('.change-payment', {
                                amazonCheckoutSessionId: data.checkoutSessionId,
                                changeAction: 'changePayment'
                            });
                        }
                    }
                });
            }
        },
        placeOrderAction: function () {
            $('.process-order-amazon').click(function (e) {
                e.preventDefault();
                if ($('.process-order-amazon').data('action')) {
                    window.location.href = $('.process-order-amazon').data('action');
                }
            })
        },
        init: function () {
            this.addButtonToCartPage();
            this.addButtonToCheckoutPage();
            this.initiateBindChangeActions();
            this.placeOrderAction();
        }
    };

    amazonPaymentsObject.init();
});
