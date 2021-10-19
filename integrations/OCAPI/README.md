# OCAPI
## OCAPI Order Authorization
To authorize the order one of two possible customization hooks is called and an `dw.order.OrderPaymentInstrument` is passed as an input argument.

Which hook is called?

- If the request includes a `payment_card` or the `dw.order.OrderPaymentInstrument` contains a `creditCardType` the customization hook `dw.order.payment.authorizeCreditCard` is called. See *`dw.order.hooks.PaymentHooks.authorizeCreditCard(order : Order, paymentDetails : OrderPaymentInstrument, cvn : String) : Status`*.
- Otherwise `dw.order.payment.authorize` is called. See *`dw.order.hooks.PaymentHooks.authorize(order : Order, paymentDetails : OrderPaymentInstrument) : Status`*.
What is the `dw.order.OrderPaymentInstrument` input argument passed to the hook?

- If the request contains a `customer_payment_instrument_id` the `dw.order.OrderPaymentInstrument` is copied from the customer payment instrument (An exception is thrown if none was found).
- Otherwise the data from the request document is passed (`payment_card` or `payment_bank_account` etc. information).
Note: the amount and the `security_code` (cvn) contained in the `payment_card` data will be propagated if available to `dw.order.payment.authorizeCreditCard` even if the `dw.order.OrderPaymentInstrument` is resolved from a customer payment instrument.

In [ApplePay](integrations/OCAPI/ApplePay) case, the authorization will call hook `dw.order.payment.authorize`.