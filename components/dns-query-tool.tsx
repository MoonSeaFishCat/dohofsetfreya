'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, Loader2, CheckCircle2, XCircle, Clock, Database, Globe } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface QueryResult {
  success: boolean;
  domain: string;
  type: string;
  answers: any[];
  responseTime: number;
  cached: boolean;
  upstream?: string;
  error?: string;
}

export function DNSQueryTool() {
  const [domain, setDomain] = useState('');
  const [recordType, setRecordType] = useState('A');
  const [useCache, setUseCache] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);

  const handleQuery = async () => {
    if (!domain.trim()) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/test-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain: domain.trim(),
          type: recordType,
          useCache,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        domain,
        type: recordType,
        answers: [],
        responseTime: 0,
        cached: false,
        error: '查询失败，请检查网络连接',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatAnswer = (answer: any) => {
    if (typeof answer === 'string') return answer;
    
    switch (answer.type) {
      case 'A':
      case 'AAAA':
        return answer.data;
      case 'CNAME':
        return `指向: ${answer.data}`;
      case 'MX':
        return `优先级 ${answer.priority}: ${answer.exchange}`;
      case 'TXT':
        return Array.isArray(answer.data) ? answer.data.join(' ') : answer.data;
      case 'NS':
        return `名称服务器: ${answer.data}`;
      default:
        return JSON.stringify(answer.data);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 查询表单 */}
      <Card className="border-blue-100 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Search className="w-5 h-5" />
            DNS查询工具
          </CardTitle>
          <CardDescription>测试DoH服务的域名解析功能</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="domain" className="text-blue-900">域名</Label>
            <Input
              id="domain"
              placeholder="例如: example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
              className="border-blue-200 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type" className="text-blue-900">记录类型</Label>
            <Select value={recordType} onValueChange={setRecordType}>
              <SelectTrigger id="type" className="border-blue-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">A - IPv4地址</SelectItem>
                <SelectItem value="AAAA">AAAA - IPv6地址</SelectItem>
                <SelectItem value="CNAME">CNAME - 别名</SelectItem>
                <SelectItem value="MX">MX - 邮件交换</SelectItem>
                <SelectItem value="TXT">TXT - 文本记录</SelectItem>
                <SelectItem value="NS">NS - 名称服务器</SelectItem>
                <SelectItem value="SOA">SOA - 授权起始</SelectItem>
                <SelectItem value="PTR">PTR - 指针记录</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useCache"
              checked={useCache}
              onChange={(e) => setUseCache(e.target.checked)}
              className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor="useCache" className="text-blue-900 cursor-pointer">
              使用缓存（更快的查询速度）
            </Label>
          </div>

          <Button
            onClick={handleQuery}
            disabled={loading || !domain.trim()}
            className="w-full bg-blue-500 hover:bg-blue-600"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                查询中...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                执行查询
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 查询结果 */}
      <Card className="border-blue-100 shadow-md">
        <CardHeader>
          <CardTitle className="text-blue-900">查询结果</CardTitle>
          <CardDescription>DNS解析详细信息</CardDescription>
        </CardHeader>
        <CardContent>
          {!result && (
            <div className="flex flex-col items-center justify-center py-12 text-blue-400">
              <Globe className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-sm">输入域名并点击查询按钮开始测试</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* 状态指示器 */}
              <div className="flex items-center gap-2">
                {result.success ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="font-medium text-green-700">查询成功</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="font-medium text-red-700">查询失败</span>
                  </>
                )}
              </div>

              <Separator />

              {/* 查询信息 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-600">域名:</span>
                  <span className="font-medium text-blue-900">{result.domain}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-600">类型:</span>
                  <Badge variant="outline">{result.type}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    响应时间:
                  </span>
                  <Badge variant="secondary">{result.responseTime}ms</Badge>
                </div>
                {result.cached && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-600 flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      缓存状态:
                    </span>
                    <Badge className="bg-green-100 text-green-700">从缓存返回</Badge>
                  </div>
                )}
                {result.upstream && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-600">上游服务器:</span>
                    <span className="font-medium text-blue-900">{result.upstream}</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* 解析结果 */}
              {result.success && result.answers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-blue-900">解析结果:</h4>
                  <div className="space-y-2">
                    {result.answers.map((answer, index) => (
                      <div
                        key={index}
                        className="p-3 bg-blue-50 rounded-lg border border-blue-100"
                      >
                        <p className="text-sm font-mono text-blue-900 break-all">
                          {formatAnswer(answer)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.success && result.answers.length === 0 && (
                <Alert>
                  <AlertDescription>
                    未找到 {result.type} 记录
                  </AlertDescription>
                </Alert>
              )}

              {/* 错误信息 */}
              {!result.success && result.error && (
                <Alert variant="destructive">
                  <AlertDescription>{result.error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card className="border-blue-100 shadow-md lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-blue-900">使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-blue-900">常用记录类型:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li><strong>A</strong> - 返回IPv4地址（如 192.0.2.1）</li>
                <li><strong>AAAA</strong> - 返回IPv6地址</li>
                <li><strong>CNAME</strong> - 域名别名记录</li>
                <li><strong>MX</strong> - 邮件服务器记录</li>
                <li><strong>TXT</strong> - 文本记录（SPF、DKIM等）</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-blue-900">DoH端点地址:</h4>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <code className="text-sm text-blue-900 break-all">
                  {typeof window !== 'undefined' 
                    ? `${window.location.origin}/api/dns-query`
                    : 'https://your-domain/api/dns-query'}
                </code>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                可在浏览器、手机或路由器中配置此DoH端点
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
