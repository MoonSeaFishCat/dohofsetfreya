'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, CheckCircle, XCircle, Clock, Download, Sparkles, Route, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface QueryLog {
  id: string;
  timestamp: number;
  domain: string;
  type: string;
  clientIp: string;
  responseTime: number;
  status: 'success' | 'error' | 'timeout' | 'blocked' | 'fakeip' | 'direct';
  cached: boolean;
  upstream?: string;
  answers?: string[];
  rcode?: string;
}

// rcode 配色喵~ NOERROR 绿 / REFUSED 拦截粉 / NXDOMAIN 琥珀 / 其他红 (ฅ'ω'ฅ)
const RCODE_STYLES: Record<string, string> = {
  NOERROR: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  REFUSED: 'bg-rose-100 text-rose-600 border-rose-200',
  NXDOMAIN: 'bg-amber-100 text-amber-700 border-amber-200',
  SERVFAIL: 'bg-red-100 text-red-600 border-red-200',
};

export function QueryLogs() {
  const [logs, setLogs] = useState<QueryLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [cached, setCached] = useState('all');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<QueryLog | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const limit = 20;

  const fetchLogs = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(page * limit));
      if (query.trim()) params.set('q', query.trim());
      if (type !== 'all') params.set('type', type);
      if (status !== 'all') params.set('status', status);
      if (cached !== 'all') params.set('cached', cached);

      const response = await fetch(`/api/logs?${params.toString()}`);
      if (!response.ok) throw new Error('获取日志失败');
      const data = await response.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setLoading(false);
    } catch (error) {
      console.error('[logs] Failed to fetch logs:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  // 自动刷新喵~ 每 5 秒静默拉一次，不打断筛选操作 (◕‿◕)
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => fetchLogs(true), 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, page, query, type, status, cached]);

  const exportCsv = async () => {
    const params = new URLSearchParams();
    params.set('format', 'csv');
    if (query.trim()) params.set('q', query.trim());
    if (type !== 'all') params.set('type', type);
    if (status !== 'all') params.set('status', status);
    if (cached !== 'all') params.set('cached', cached);

    const response = await fetch(`/api/logs?${params.toString()}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dns-logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (timestamp: number) => new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const filteredSummary = useMemo(() => ({
    total,
    success: logs.filter((log) => log.status === 'success' || log.status === 'fakeip').length,
    direct: logs.filter((log) => log.status === 'direct').length,
    cachedCount: logs.filter((log) => log.cached).length,
  }), [logs, total]);

  const getStatusIcon = (value: string) => {
    switch (value) {
      case 'success': return <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500" />;
      case 'error': return <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />;
      case 'timeout': return <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500" />;
      case 'blocked': return <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-rose-400" />;
      case 'fakeip': return <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-violet-500" />;
      case 'direct': return <Route className="w-3 h-3 sm:w-4 sm:h-4 text-teal-500" />;
      default: return null;
    }
  };

  const getStatusBadge = (value: string) => {
    switch (value) {
      case 'success': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">成功</Badge>;
      case 'error': return <Badge className="bg-red-100 text-red-600 border-red-200 text-xs">失败</Badge>;
      case 'timeout': return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">超时</Badge>;
      case 'blocked': return <Badge className="bg-rose-100 text-rose-600 border-rose-200 text-xs">拦截</Badge>;
      case 'fakeip': return <Badge className="bg-violet-100 text-violet-600 border-violet-200 text-xs">代答</Badge>;
      case 'direct': return <Badge className="bg-teal-100 text-teal-600 border-teal-200 text-xs">直连</Badge>;
      default: return <Badge variant="outline" className="text-xs">{value}</Badge>;
    }
  };

  const getRcodeBadge = (rcode?: string) => {
    if (!rcode) return null;
    return <Badge variant="outline" className={`text-xs ${RCODE_STYLES[rcode] || 'bg-orange-50 text-amber-700 border-orange-200'}`}>{rcode}</Badge>;
  };

  const detailRows = (log: QueryLog) => [
    { label: '域名', value: log.domain },
    { label: '查询类型', value: log.type },
    { label: '响应码', value: log.rcode || '—' },
    { label: '耗时', value: `${log.responseTime}ms` },
    { label: '命中缓存', value: log.cached ? '是' : '否' },
    { label: '上游/直连', value: log.upstream || '—' },
    { label: '客户端 IP', value: log.clientIp },
    { label: '日志 ID', value: log.id },
  ];

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-orange-100 shadow-soft">
        <CardHeader className="p-3 sm:p-4 sm:pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-amber-900 text-sm sm:text-base">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                查询日志
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">点击条目查看详情 · 支持搜索、筛选和导出</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${autoRefresh ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-orange-50 border-orange-200 text-amber-700'}`}
              >
                自动刷新{autoRefresh ? '·开' : ''}
              </button>
              <Button variant="outline" size="sm" onClick={() => fetchLogs()}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <Input placeholder="搜索域名" value={query} onChange={(e) => setQuery(e.target.value)} />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue placeholder="类型" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="A">A</SelectItem>
                <SelectItem value="AAAA">AAAA</SelectItem>
                <SelectItem value="CNAME">CNAME</SelectItem>
                <SelectItem value="MX">MX</SelectItem>
                <SelectItem value="TXT">TXT</SelectItem>
                <SelectItem value="NS">NS</SelectItem>
                <SelectItem value="SOA">SOA</SelectItem>
                <SelectItem value="PTR">PTR</SelectItem>
                <SelectItem value="HTTPS">HTTPS</SelectItem>
                <SelectItem value="SVCB">SVCB</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="状态" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="success">成功</SelectItem>
                <SelectItem value="error">失败</SelectItem>
                <SelectItem value="timeout">超时</SelectItem>
                <SelectItem value="blocked">拦截</SelectItem>
                <SelectItem value="fakeip">代答</SelectItem>
                <SelectItem value="direct">直连</SelectItem>
              </SelectContent>
            </Select>
            <Select value={cached} onValueChange={setCached}>
              <SelectTrigger><SelectValue placeholder="缓存" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部缓存</SelectItem>
                <SelectItem value="true">仅缓存</SelectItem>
                <SelectItem value="false">仅非缓存</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => { setPage(0); fetchLogs(); }}>筛选</Button>
              <Button variant="outline" onClick={exportCsv}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full" /></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-amber-500">
              <FileText className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-50" />
              <p className="text-sm">暂无查询日志</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] sm:max-h-[500px] md:max-h-[600px] overflow-y-auto">
              {logs.map((log) => (
                <button
                  key={log.id}
                  onClick={() => setSelected(log)}
                  className="w-full text-left p-2 sm:p-3 bg-orange-50/50 rounded-xl border border-orange-100 hover:bg-orange-50 hover:border-orange-200 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className="bg-orange-50 text-xs shrink-0">{log.type}</Badge>
                        <span className="font-medium text-amber-900 text-xs sm:text-sm truncate">{log.domain}</span>
                        {getRcodeBadge(log.rcode)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-amber-700/80">
                        <span>{formatTimestamp(log.timestamp)}</span>
                        {log.cached && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">缓存</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      {getStatusIcon(log.status)}
                      {getStatusBadge(log.status)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-amber-700/80 min-w-0">
                    <Badge variant="secondary" className="text-xs shrink-0">{log.responseTime}ms</Badge>
                    {log.upstream && <span className="truncate hidden sm:inline">{log.upstream}</span>}
                    <span className="truncate hidden md:inline">{log.clientIp}</span>
                    {log.answers && log.answers.length > 0 && (
                      <span className="truncate text-amber-600/70 ml-auto">
                        → {log.answers[0]}{log.answers.length > 1 ? ` +${log.answers.length - 1}` : ''}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-amber-700/80">第 {page + 1} / {totalPages} 页 · 共 {total} 条</span>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="border-orange-100 bg-gradient-to-br from-orange-50 to-[#FFFCF8] shadow-soft">
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-4"><CardTitle className="text-xs sm:text-sm text-amber-900">筛选总数</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0"><div className="text-xl sm:text-2xl font-bold text-orange-500">{filteredSummary.total}</div></CardContent>
        </Card>
        <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-[#FFFCF8] shadow-soft">
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-4"><CardTitle className="text-xs sm:text-sm text-emerald-900">DoH 成功</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0"><div className="text-xl sm:text-2xl font-bold text-emerald-600">{filteredSummary.success}</div></CardContent>
        </Card>
        <Card className="border-teal-100 bg-gradient-to-br from-teal-50 to-[#FFFCF8] shadow-soft">
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-4"><CardTitle className="text-xs sm:text-sm text-teal-900">直连分流</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0"><div className="text-xl sm:text-2xl font-bold text-teal-600">{filteredSummary.direct}</div></CardContent>
        </Card>
        <Card className="border-rose-100 bg-gradient-to-br from-rose-50 to-[#FFFCF8] shadow-soft">
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-4"><CardTitle className="text-xs sm:text-sm text-rose-900">缓存命中</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0"><div className="text-xl sm:text-2xl font-bold text-rose-500">{filteredSummary.cachedCount}</div></CardContent>
        </Card>
      </div>

      {/* 日志详情弹窗喵~ 点开看完整报文路径和答案列表 (◕‿◕) */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg bg-[#FFFCF8] border-orange-100">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-amber-900">
                  {getStatusIcon(selected.status)}
                  <span className="truncate">{selected.domain}</span>
                  {getStatusBadge(selected.status)}
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {detailRows(selected).map((row) => (
                  <div key={row.label} className="min-w-0">
                    <div className="text-xs text-amber-600/70">{row.label}</div>
                    <div className="text-amber-900 font-medium truncate" title={row.value}>{row.value}</div>
                  </div>
                ))}
                <div className="col-span-2 min-w-0">
                  <div className="text-xs text-amber-600/70">时间</div>
                  <div className="text-amber-900 font-medium">{new Date(selected.timestamp).toLocaleString('zh-CN')}</div>
                </div>
              </div>
              {selected.answers && selected.answers.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-amber-600/70 mb-1">应答记录（{selected.answers.length}）</div>
                  <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg bg-orange-50/60 border border-orange-100 p-2">
                    {selected.answers.map((answer, index) => (
                      <div key={index} className="text-xs font-mono text-amber-800 break-all">{answer}</div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
