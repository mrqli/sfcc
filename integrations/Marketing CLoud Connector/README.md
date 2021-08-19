# Marketing Cloud SFRA Version
To get SFMC cartridge, go to [Marketing Cloud Connector](https://github.com/SalesforceCommerceCloud/marketing-cloud-connector) repo in SFCC GitHub. Current version is V2.3.0
### Setup
Follow the official integration documentation. Link is [here](https://github.com/SalesforceCommerceCloud/marketing-cloud-connector/blob/master/docs/1_0_Project_Overview.md)<br>

A few fixes that need to be done manually in the official integration documentation are:

1. Put synchronous-promise.js to cartridges/modules directory

2. When setting marketingcloud.rest.auth credentials, append v2/token to the Rest base URI.

3. Change `TempCustomer` to `customer` in `cartridges/int_marketing_cloud/cartridge/scripts/communication/account.js`

4. Update `PartnerAPI` service soap address to your soap base URI in `cartridges/int_marketing_cloud/cartridge/webreferences2/etframework.wsdl`

5. Update the external keys of data extension in Postman scripts to match the ones defined in cartridges

6. Pay attention to the cartridge path.  For Brooks Brothers, the path would follow an order like *`app_brooksbrothers_core:app_accelerator_core:plugin_marketing_cloud_custom:plugin_marketing_cloud:app_storefront_base:int_marketing_cloud:int_handlerframework`*
*`plugin_marketing_cloud_custom`* and *`plugin_marketing_cloud`* should sit between *`app_accelerator_core`* and *`app_storefront_base`*

7. If you create a custom cartridge to extend the OOTB SFMC cartridge and extend the hook scripts, you need to move the hooks in `hooks.json` the OOTB cartridge to the custom cartridge. Otherwise, the hooks will be registered and called twice, and only the last hook returns a value.

### Steps of adding a custom trigger
SFMC side:
1. Create an email template

2. Create a data extension and add necessary fields.

3. Create a Triggered Send with the same external key as the one for the extension created above. Select the email template in step 1 for content and the data extension in step 2 for subscriber management.

4. Save/publish the change and start the trigger.

5. If anything needs change in the triggered send, pause the trigger first and make the change, then publish the change and restart the trigger.

SFCC side:
1. Create a MarketingCloudTriggers object with a hookID and the same external key used in SFMC.

2. Map subscriber attributes to the attributes of data extension in SFMC. The format is
```JSON
{
  "(SFCC_Viarable/SFCC_Object.attribute)": "(SFMC_Attribute)"
}
```
e.g.
```JSON
{
    "SiteID": "SiteID",
    "Subscribe.email": "EmailAddress"
}
```
3. Select Enabled and apply/save changes.

4. Add the hook to `int_marketing_cloud` in `CommunicationHandlers` object. The format is
```JSON
{
    "name": "(hookID)",
    "script": "(file path)",
    "enabled": true
}
```
5. Add email type to `emailHelpers.emailTypes` in `cartridges/plugin_marketing_cloud_custom/cartridge/scripts/helpers/emailHelpers.js`

6. Add a corresponding switch case in `cartridges/plugin_marketing_cloud_custom/cartridge/scripts/hookProxy/emailProxy.js`

7. Add a hook that matches the hookID in `MarketingCloudTriggers` to `hooks.json` and create the hook script.

### Custom Code

### Limitations
