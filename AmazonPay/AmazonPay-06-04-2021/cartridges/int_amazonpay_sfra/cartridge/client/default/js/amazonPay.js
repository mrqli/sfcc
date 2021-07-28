'use strict';

var processInclude = require('./util');

$(document).ready(function () {
    processInclude(require('./amazonPay/amazonPay'));
});
