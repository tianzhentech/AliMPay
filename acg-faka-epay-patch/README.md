# ACG-Faka 易支付插件补丁：显示网关加零头后的实际应付金额

适用场景：卡网使用「易支付」插件对接一个按“金额加零头”区分订单的支付网关（例如个人收款码网关），
网关 `/mapi.php` 返回的 `money` 比下单金额多几分钱（如 0.01 → 0.06）。

原插件的问题：只要网关返回 `qrcode`，就用卡网自带收银台渲染，页面只显示订单原价，丢弃了网关返回的 `money`，
买家按原价付款后网关无法匹配订单，回调不会触发。

## 改动
- `app/Pay/Epay/Impl/Pay.php`：读取网关返回的 `money`，与下单金额相差 0.004~1.0 元时写入 option `gateway_money`，并在收银台提示“请务必按页面显示的金额付款”。
- `app/Service/Bind/Order.php`：商品订单下单后，把 `gateway_amount` 设为网关返回的金额（收银台据此显示，回调也据此核对）；回调核对时同时接受“实际应付金额”和“下单原价”（回调仍需通过签名校验）。
- `app/Service/Bind/Recharge.php`：充值订单做同样的处理。

## 使用
在卡网根目录执行（先备份）：

    cp -a app/Pay/Epay app/Service/Bind/Order.php app/Service/Bind/Recharge.php /root/bak/
    patch -p1 --binary < epay-gateway-money.patch

`Pay.php` 为 CRLF 换行，补丁已保留，请用 `--binary` 应用。升级卡网后如被覆盖需要重新应用。
