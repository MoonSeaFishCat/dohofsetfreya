'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Gauge, Plus, Save, Settings, Shield, Trash2, User } from 'lucide-react';

interface UpstreamServer {
  name: string;
  url: string;
  priority: number;
  enabled: boolean;
}

interface SettingsData {
  upstreamServers: UpstreamServer[];
  auth: { username: string };
  storageType: string;
  cacheEnabled: boolean;
  cacheTTL: number;
  cacheMaxEntries: number;
  enableLogging: boolean;
  maxLogEntries: number;
  rateLimit: number;
  blocklist: string[];
  filterMode: 'off' | 'blacklist' | 'whitelist';
  filterAction: 'refuse' | 'direct';
  directResolver: string;
  fakeIpRules: string[];
  fakeIpAddress: string;
  upstreamPolicy: 'priority' | 'round-robin';
  upstreamTimeout: number;
}

// 常用直连解析器预设喵~ 选完还能在输入框里继续手改 (๑•̀ㅂ•́)و✧
const DIRECT_RESOLVER_PRESETS = [
  { value: 'auto', label: 'auto · 跟随系统 DNS（推荐）' },
  { value: 'udp://223.5.5.5', label: '阿里 DNS · udp://223.5.5.5' },
  { value: 'udp://119.29.29.29', label: '腾讯 DNSPod · udp://119.29.29.29' },
  { value: 'udp://114.114.114.114', label: '114 DNS · udp://114.114.114.114' },
  { value: 'udp://1.1.1.1', label: 'Cloudflare · udp://1.1.1.1' },
  { value: 'udp://8.8.8.8', label: 'Google · udp://8.8.8.8' },
  { value: 'https://223.5.5.5/dns-query', label: '阿里 DoH · 223.5.5.5' },
  { value: 'https://doh.pub/dns-query', label: '腾讯 DoH · doh.pub' },
  { value: 'https://dns.google/dns-query', label: 'Google DoH · dns.google' },
];

const DEFAULT_SETTINGS: SettingsData = {
  upstreamServers: [],
  auth: { username: '' },
  storageType: 'memory',
  cacheEnabled: true,
  cacheTTL: 300,
  cacheMaxEntries: 1000,
  enableLogging: true,
  maxLogEntries: 1000,
  rateLimit: 0,
  blocklist: [],
  filterMode: 'blacklist',
  filterAction: 'refuse',
  directResolver: 'auto',
  fakeIpRules: [],
  fakeIpAddress: '198.18.0.1',
  upstreamPolicy: 'priority',
  upstreamTimeout: 5000,
};

export function ConfigurationPanel() {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [blocklistText, setBlocklistText] = useState('');
  const [fakeIpText, setFakeIpText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // 直连解析器测速结果喵~ key 是 resolver 值，null 表示超时/失败 (´･ω･`)
  const [resolverLatency, setResolverLatency] = useState<Record<string, number | null>>({});
  const [testingResolvers, setTestingResolvers] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings', { credentials: 'include' });
      if (!response.ok) throw new Error('获取设置失败');
      const data: SettingsData = await response.json();
      setSettings({ ...DEFAULT_SETTINGS, ...data });
      setNewUsername(data.auth?.username || '');
      setBlocklistText((data.blocklist || []).join('\n'));
      setFakeIpText((data.fakeIpRules || []).join('\n'));
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取设置失败');
    }
  };

  const saveDNSSettings = async () => {
    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dnsSettings: {
            ...settings,
            // 换行或逗号都能分隔规则喵~ 怎么写都行 (ฅ'ω'ฅ)
            blocklist: blocklistText.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
            fakeIpRules: fakeIpText.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
          },
        }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || '保存失败');
      setSettings({ ...settings, ...data });
      setBlocklistText((data.blocklist || []).join('\n'));
      setFakeIpText((data.fakeIpRules || []).join('\n'));
      setMessage('DNS 配置已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 批量测速喵~ 预设全测一遍，自定义值也捎上 (๑>◡<๑)
  const testResolvers = async () => {
    setTestingResolvers(true);
    try {
      const targets = [...new Set([...DIRECT_RESOLVER_PRESETS.map((p) => p.value), settings.directResolver].filter(Boolean))];
      const response = await fetch('/api/test-resolver', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolvers: targets }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '测速失败');
      const map: Record<string, number | null> = {};
      for (const item of data.results || []) {
        map[item.resolver] = item.ok ? item.latency : null;
      }
      setResolverLatency(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : '测速失败');
    } finally {
      setTestingResolvers(false);
    }
  };

  const latencyLabel = (value: string) => {
    const latency = resolverLatency[value];
    if (latency === undefined) return '';
    return latency === null ? ' · ✗超时' : ` · ${latency}ms`;
  };

  const saveAuth = async () => {
    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      if (!newUsername.trim()) throw new Error('用户名不能为空');
      if (!newPassword) throw new Error('请输入新密码');
      if (newPassword.length < 6) throw new Error('密码长度至少6位');
      if (newPassword !== confirmPassword) throw new Error('两次输入的密码不一致');

      const response = await fetch('/api/settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth: { username: newUsername, password: newPassword } }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || '保存失败');
      setSettings((current) => ({ ...current, auth: { username: newUsername } }));
      setNewPassword('');
      setConfirmPassword('');
      setMessage('登录凭证已更新，下次登录生效');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const updateServer = (index: number, patch: Partial<UpstreamServer>) => {
    setSettings((current) => ({
      ...current,
      upstreamServers: current.upstreamServers.map((server, serverIndex) => (
        serverIndex === index ? { ...server, ...patch } : server
      )),
    }));
  };

  const addServer = () => {
    setSettings((current) => ({
      ...current,
      upstreamServers: [
        ...current.upstreamServers,
        {
          name: '新DNS服务器',
          url: 'https://dns.example.com/dns-query',
          priority: current.upstreamServers.length + 1,
          enabled: true,
        },
      ],
    }));
  };

  const removeServer = (index: number) => {
    setSettings((current) => ({
      ...current,
      upstreamServers: current.upstreamServers.filter((_, serverIndex) => serverIndex !== index),
    }));
  };

  const dohEndpoint = typeof window !== 'undefined'
    ? `${window.location.origin}/api/dns-query`
    : 'https://your-domain/api/dns-query';

  return (
    <div className="space-y-4 sm:space-y-6">
      {(message || error) && (
        <Alert className={error ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}>
          <AlertDescription className={error ? 'text-red-600' : 'text-emerald-700'}>
            {error || message}
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-orange-100 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900 text-base sm:text-lg">
            <Shield className="w-5 h-5 text-orange-500" />
            登录凭证
          </CardTitle>
          <CardDescription>修改管理后台登录用户名和密码</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="username" className="pl-10" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>当前用户名</Label>
              <Input value={settings.auth.username} disabled className="bg-orange-50/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">新密码</Label>
              <Input id="password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">确认密码</Label>
              <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Button onClick={saveAuth} disabled={isSaving} className="bg-orange-400 hover:bg-orange-500 rounded-full">
              <Save className="w-4 h-4 mr-2" />
              保存凭证
            </Button>
            <span className="text-xs text-muted-foreground">
              存储模式 <Badge variant="outline">{settings.storageType === 'kv' ? 'Vercel KV' : settings.storageType === 'redis' ? 'Redis' : '内存'}</Badge>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-100 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900 text-base sm:text-lg">
            <Settings className="w-5 h-5 text-orange-500" />
            DoH 服务设置
          </CardTitle>
          <CardDescription>服务端点、缓存、上游策略和域名过滤</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>服务地址</Label>
            <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
              <code className="text-xs sm:text-sm text-amber-900 break-all">{dohEndpoint}</code>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50/50 p-3 text-sm text-amber-900">
              <input type="checkbox" checked={settings.cacheEnabled} onChange={(e) => setSettings({ ...settings, cacheEnabled: e.target.checked })} className="accent-orange-500" />
              启用缓存
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50/50 p-3 text-sm text-amber-900">
              <input type="checkbox" checked={settings.enableLogging} onChange={(e) => setSettings({ ...settings, enableLogging: e.target.checked })} className="accent-orange-500" />
              启用日志
            </label>
            <div className="space-y-2">
              <Label>缓存 TTL 秒</Label>
              <Input type="number" value={settings.cacheTTL} onChange={(e) => setSettings({ ...settings, cacheTTL: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>缓存上限</Label>
              <Input type="number" value={settings.cacheMaxEntries} onChange={(e) => setSettings({ ...settings, cacheMaxEntries: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>上游策略</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={settings.upstreamPolicy} onChange={(e) => setSettings({ ...settings, upstreamPolicy: e.target.value as SettingsData['upstreamPolicy'] })}>
                <option value="priority">优先级 fallback</option>
                <option value="round-robin">轮询 + fallback</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>上游超时 ms</Label>
              <Input type="number" value={settings.upstreamTimeout} onChange={(e) => setSettings({ ...settings, upstreamTimeout: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>最大日志数</Label>
              <Input type="number" value={settings.maxLogEntries} onChange={(e) => setSettings({ ...settings, maxLogEntries: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>限流 次/分钟</Label>
              <Input type="number" value={settings.rateLimit} onChange={(e) => setSettings({ ...settings, rateLimit: Number(e.target.value) })} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>域名过滤模式</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={settings.filterMode}
                onChange={(e) => setSettings({ ...settings, filterMode: e.target.value as SettingsData['filterMode'] })}
              >
                <option value="off">关闭过滤（所有域名都走 DoH）</option>
                <option value="blacklist">黑名单：命中规则的域名被过滤</option>
                <option value="whitelist">白名单：仅命中规则的域名走 DoH</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>命中动作</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={settings.filterAction}
                onChange={(e) => setSettings({ ...settings, filterAction: e.target.value as SettingsData['filterAction'] })}
                disabled={settings.filterMode === 'off'}
              >
                <option value="refuse">拒绝：返回 REFUSED（网站会打不开）</option>
                <option value="direct">直连：分流到直连解析器（不影响浏览）</option>
              </select>
            </div>
          </div>
          {settings.filterMode !== 'off' && settings.filterAction === 'direct' && (
            <div className="space-y-2">
              <Label>直连解析器</Label>
              <div className="flex flex-col sm:flex-row gap-2 max-w-2xl">
                <select
                  className="h-10 sm:w-72 shrink-0 rounded-md border border-input bg-background px-3 text-sm"
                  value={DIRECT_RESOLVER_PRESETS.some((p) => p.value === settings.directResolver) ? settings.directResolver : 'custom'}
                  onChange={(e) => {
                    if (e.target.value !== 'custom') {
                      setSettings({ ...settings, directResolver: e.target.value });
                    }
                  }}
                >
                  {DIRECT_RESOLVER_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>{preset.label}{latencyLabel(preset.value)}</option>
                  ))}
                  <option value="custom">自定义…{latencyLabel(settings.directResolver)}</option>
                </select>
                <Input
                  className="flex-1"
                  value={settings.directResolver}
                  onChange={(e) => setSettings({ ...settings, directResolver: e.target.value })}
                  placeholder="auto 或 udp://223.5.5.5 或 https://…/dns-query"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 shrink-0"
                  onClick={testResolvers}
                  disabled={testingResolvers}
                >
                  <Gauge className="w-4 h-4 mr-1" />
                  {testingResolvers ? '测速中…' : '测速'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                <code>auto</code> 跟随系统 DNS（等价本机浏览器当前在用的解析器）；也可选预设或直接手填 <code>udp://IP[:端口]</code> / <code>https://.../dns-query</code>。
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {settings.filterAction === 'direct'
              ? '被过滤的域名改由直连解析器解析真实 IP，其他网页正常加载——这才是"不影响浏览"的正确姿势喵~'
              : '注意：REFUSED 在 Chrome/Edge 安全模式下不会回退本地 DNS，被过滤的网站会直接打不开！'}
            浏览器探针域名（www.gstatic.com）始终放行，保证提供商验证通过。
          </p>

          <div className="space-y-2">
            <Label>过滤规则</Label>
            <Textarea
              value={blocklistText}
              onChange={(e) => setBlocklistText(e.target.value)}
              placeholder="每行一条或用逗号分隔，例如：ads.example.com、.tracking.example、*.bad.example"
              className="min-h-28 font-mono text-sm"
              disabled={settings.filterMode === 'off'}
            />
            <p className="text-xs text-muted-foreground">
              支持精确域名、`.后缀`（匹配该域名及子域）和 `*.` 通配符。
              {settings.filterMode === 'whitelist' && ' 注意：白名单模式下规则为空将拒绝所有域名！'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>SNI 阻断代答规则</Label>
            <Textarea
              value={fakeIpText}
              onChange={(e) => setFakeIpText(e.target.value)}
              placeholder="每行一条或用逗号分隔，例如：*.linux.do"
              className="min-h-20 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              命中规则的域名：A 查询返回下方虚拟 IP、AAAA 返回空记录。浏览器随后对虚拟 IP 的连接需由本地代理（mihomo / sing-box 的 TUN + SNI 嗅探）接管，以绕开 SNI 阻断。
            </p>
          </div>

          <div className="space-y-2 max-w-xs">
            <Label>代答虚拟 IP</Label>
            <Input
              value={settings.fakeIpAddress}
              onChange={(e) => setSettings({ ...settings, fakeIpAddress: e.target.value })}
              placeholder="198.18.0.1"
            />
            <p className="text-xs text-muted-foreground">
              建议使用保留段 198.18.0.0/15 内的地址，与本地代理的 fake-ip 范围保持一致。
            </p>
          </div>

          <div className="pt-2 border-t border-orange-100">
            <Button onClick={saveDNSSettings} disabled={isSaving} className="bg-orange-400 hover:bg-orange-500 rounded-full">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? '保存中...' : '保存服务设置'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-100 shadow-soft">
        <CardHeader>
          <CardTitle className="text-amber-900 text-base sm:text-lg">上游 DNS 服务器</CardTitle>
          <CardDescription>按策略顺序尝试，失败时自动 fallback 到下一个上游</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.upstreamServers.map((server, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-orange-100 bg-orange-50/50 p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>名称</Label>
                  <Input value={server.name} onChange={(e) => updateServer(index, { name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>优先级</Label>
                  <Input type="number" value={server.priority} onChange={(e) => updateServer(index, { priority: Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>DoH URL</Label>
                <Input value={server.url} onChange={(e) => updateServer(index, { url: e.target.value })} />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-amber-900">
                  <input type="checkbox" checked={server.enabled} onChange={(e) => updateServer(index, { enabled: e.target.checked })} className="accent-orange-500" />
                  启用
                </label>
                <Button variant="ghost" size="sm" onClick={() => removeServer(index)} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50">
                  <Trash2 className="w-4 h-4 mr-1" />
                  删除
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={addServer} className="w-full border-dashed border-orange-300 hover:bg-orange-50 rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            添加上游 DNS 服务器
          </Button>
        </CardContent>
      </Card>

      <Button onClick={saveDNSSettings} disabled={isSaving} className="w-full bg-orange-400 hover:bg-orange-500 rounded-full">
        <Save className="w-4 h-4 mr-2" />
        {isSaving ? '保存中...' : '保存 DNS 配置'}
      </Button>
    </div>
  );
}
