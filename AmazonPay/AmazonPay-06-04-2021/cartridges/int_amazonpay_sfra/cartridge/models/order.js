'use strict';

var base = module.superModule;

/**
 * Order class that represents the current order
 * @param {dw.order.LineItemCtnr} lineItemContainer - Current users's basket/order
 * @param {Object} options - The current order's line items
 * @param {Object} options.config - Object to help configure the orderModel
 * @param {string} options.config.numberOfLineItems - helps determine the number of lineitems needed
 * @param {string} options.countryCode - the current request country code
 * @constructor
 */
function OrderModel(lineItemContainer, options) {
    base.call(this, lineItemContainer, options);
    if (lineItemContainer.custom.hasOwnProperty('amzPayRedirectURL') && lineItemContainer.custom.amzPayRedirectURL !== null) { // eslint-disable-line no-prototype-builtins
        this.amzPayRedirectURL = lineItemContainer.custom.amzPayRedirectURL;
    }

    if (lineItemContainer.custom.hasOwnProperty('amzPayCheckoutSessionId') && lineItemContainer.custom.amzPayCheckoutSessionId !== null) { // eslint-disable-line no-prototype-builtins
        this.amzPayCheckoutSessionId = lineItemContainer.custom.amzPayCheckoutSessionId;
    }
}

OrderModel.prototype = Object.create(base.prototype);

module.exports = OrderModel;
