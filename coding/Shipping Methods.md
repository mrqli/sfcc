# Shipping Methods
## ShipmentShippingModel
- `getApplicableShippingMethods() : Collection`
Returns the active applicable shipping methods for the shipment related to this shipping model. A shipping method is applicable for a shipment if it does not exclude any of the products in the shipment, and does not exclude the shipment's shipping address, if this is set. Also checks that the the shipment customer belongs to an assigned customer group of the shipment (if any are assigned).

- `getApplicableShippingMethods(shippingAddressObj : Object) : Collection`
Returns the active applicable shipping methods for the shipment related to this shipping model and the specified shipping address. A shipping method is applicable if it does not exclude any of the products in the shipment, it does not exclude the specified shipping address, and the shipment customer belongs to an assigned customer group for the shipment (if any are assigned).
The parameter shippingAddressObj must be a JavaScript literal with the same properties as an OrderAddress object, or alternatively a Map. For example:
```
 model.getApplicableShippingMethods (
    { countryCode: "US",
      stateCode: "MA,
      custom { POBox : true }
    }
 )
```
**This method is useful when it is needed to retrieve the list of applicable shipping methods for an address before the address is saved to the shipment.**

Takeaways from work:
- If a shipping address is already saved to the shipment, `getApplicableShippingMethods(shippingAddressObj)` actually won't work to get new applicable shipping methods. SFCC will use the saved address anyway.
- The applicable shipping methods are determined by the shipping methods settings in Business Manager. Some key attributes are address1, city, state, country. If any of them is missing, the applicable shipping methods returned may not be accurate.