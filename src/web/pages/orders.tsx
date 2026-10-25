import { ChevronLeft, ChevronRight, ExternalLink, FlaskConical, Search } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import useSWR, { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import type { OrderRecord, OrderStatus } from "@/shared/contracts";
import { apiFetch, jsonBody, swrFetcher } from "@/web/api";
import { PageHeader } from "@/web/components/page-header";
import { StatusBadge } from "@/web/components/status-badge";
import { Button } from "@/web/components/ui/button";
import { Card, CardContent } from "@/web/components/ui/card";
import { Input } from "@/web/components/ui/input";
import { Loading } from "@/web/components/ui/loading";
import { formatDate, formatMoney } from "@/web/lib/utils";

interface OrdersResponse {
  data: OrderRecord[];
  total: number;
  limit: number;
  page: number;
}

interface TestOrderResponse {
  order: OrderRecord;
  checkout_url: string;
}

export function OrdersPage() {
  const [testAmount, setTestAmount] = useState("0.01");
  const [creating, setCreating] = useState(false);
  const [testOrder, setTestOrder] = useState<TestOrderResponse | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [page, setPage] = useState(1);
  const path = `/admin-api/orders?page=${page}&limit=20&status=${encodeURIComponent(status)}&q=${encodeURIComponent(query)}`;
  const { data, isLoading } = useSWR<OrdersResponse>(path, swrFetcher, { refreshInterval: 5_000 });
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));

  async function createTestOrder() {
    setCreating(true);
    try {
      const result = await apiFetch<TestOrderResponse>("/admin-api/orders/test", { method: "POST", ...jsonBody({ amount: testAmount.trim() || "0.01" }) });
      setTestOrder(result);
      toast.success("测试订单已创建");
      await globalMutate((key) => typeof key === "string" && key.startsWith("/admin-api/orders"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建测试订单失败");
    } finally {
      setCreating(false);
    }
  }

  function search(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(queryInput.trim());
  }

  return (
    <>
      <PageHeader
        title="订单"
        description="查询商户订单、支付匹配结果和通知投递记录。"
        actions={(
          <>
            <Input className="w-24" value={testAmount} onChange={(event) => setTestAmount(event.target.value)} inputMode="decimal" placeholder="0.01" aria-label="测试金额（元）" />
            <Button type="button" onClick={createTestOrder} disabled={creating}><FlaskConical />{creating ? "创建中" : "创建测试订单"}</Button>
          </>
        )}
      />
      {testOrder ? (
        <Card className="mb-5">
          <CardContent className="flex flex-col gap-3 pt-5 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium">测试订单 {testOrder.order.trade_no}</div>
              <div className="mt-1 text-muted">请按收银台显示的金额 {formatMoney(testOrder.order.payable_amount_cents)} 付款；回调会发送到网关自带的测试接收地址并自动应答 success。</div>
            </div>
            <div className="flex gap-2">
              <a href={testOrder.checkout_url} target="_blank" rel="noreferrer"><Button type="button" variant="outline"><ExternalLink />打开收银台</Button></a>
              <Link to={`/orders/${testOrder.order.id}`}><Button type="button" variant="outline">订单详情</Button></Link>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardContent className="pt-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <form className="flex flex-1 gap-2" onSubmit={search}>
              <Input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="平台订单号、商户订单号或商品名称" aria-label="搜索订单" />
              <Button type="submit" variant="outline"><Search />搜索</Button>
            </form>
            <select
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
              value={status}
              onChange={(event) => { setStatus(event.target.value as OrderStatus | ""); setPage(1); }}
              aria-label="订单状态"
            >
              <option value="">全部状态</option><option value="pending">等待支付</option><option value="expired">已过期</option><option value="paid">支付成功</option><option value="late_paid">迟到支付</option>
            </select>
          </div>

          {isLoading ? <Loading /> : !data?.data.length ? <div className="py-16 text-center text-sm text-muted">没有符合条件的订单</div> : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b text-xs text-muted"><tr><th className="pb-3 font-medium">平台订单号</th><th className="pb-3 font-medium">商户订单号</th><th className="pb-3 font-medium">接口</th><th className="pb-3 font-medium">金额</th><th className="pb-3 font-medium">实付</th><th className="pb-3 font-medium">状态</th><th className="pb-3 text-right font-medium">创建时间</th></tr></thead>
                <tbody className="divide-y">
                  {data?.data.map((order) => (
                    <tr key={order.id} className="hover:bg-foreground/[0.025]">
                      <td className="py-3 font-mono text-xs"><Link className="hover:text-primary" to={`/orders/${order.id}`}>{order.trade_no}</Link></td>
                      <td className="py-3 font-mono text-xs">{order.out_trade_no}</td>
                      <td className="py-3 uppercase text-muted">{order.api_version}</td>
                      <td className="py-3 font-mono">{formatMoney(order.requested_amount_cents)}</td>
                      <td className="py-3 font-mono">{formatMoney(order.payable_amount_cents)}</td>
                      <td className="py-3"><StatusBadge status={order.status} /></td>
                      <td className="py-3 text-right text-xs text-muted">{formatDate(order.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm text-muted">
            <span>共 {data?.total ?? 0} 笔</span>
            <div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="上一页" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft /></Button><span className="min-w-16 text-center">{page} / {pages}</span><Button variant="outline" size="icon" aria-label="下一页" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}><ChevronRight /></Button></div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
