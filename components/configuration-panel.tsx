'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Globe, Book, Smartphone, Laptop, Router, Plus, Trash2, Save } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UpstreamServer {
  name: string;
  url: string;
  priority: number;
  enabled: boolean;
}

export function ConfigurationPanel() {
  const [upstreamServers, setUpstreamServers] = useState<UpstreamServer[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      setUpstreamServers(data.upstreamServers || []);
    } catch (error) {
      console.error('获取设置失败:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upstreamServers }),
      });

      if (response.ok) {
        setIsEditing(false);
      }
    } catch (error) {
      console.error('保存设置失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const addServer = () => {
    setUpstreamServers([
      ...upstreamServers,
      {
        name: '新DNS服务器',
        url: 'https://dns.example.com/dns-query',
        priority: upstreamServers.length + 1,
        enabled: true,
      },
    ]);
  };

  const removeServer = (index: number) => {
    setUpstreamServers(upstreamServers.filter((_, i) => i !== index));
  };

  const updateServer = (index: number, field: keyof UpstreamServer, value: any) => {
    const updated = [...upstreamServers];
    updated[index] = { ...updated[index], [field]: value };
    setUpstreamServers(updated);
  };
  const dohEndpoint = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/dns-query`
    : 'https://your-domain/api/dns-query';

  return (
    <div className="space-y-6">
      {/* DoH端点信息 */}
      <Card className="border-blue-100 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Settings className="w-5 h-5" />
            DoH服务端点配置
          </CardTitle>
          <CardDescription>DNS over HTTPS (DoH)服务的连接信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900">服务地址:</span>
              <Badge className="bg-blue-500">RFC 8484标准</Badge>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <code className="text-sm text-blue-900 break-all font-mono">
                {dohEndpoint}
              </code>
            </div>
          </div>

          <Separator />

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-blue-900">支持的请求方式</h4>
              <ul className="space-y-2 text-sm text-blue-700">
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5 shrink-0">GET</Badge>
                  <span>支持Base64URL编码的DNS查询（?dns=参数）</span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5 shrink-0">POST</Badge>
                  <span>支持DNS wire format请求体</span>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-blue-900">Content-Type</h4>
              <ul className="space-y-2 text-sm">
                <li className="p-2 bg-blue-50 rounded border border-blue-100">
                  <code className="text-blue-900">application/dns-message</code>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 配置指南 */}
      <Card className="border-blue-100 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Book className="w-5 h-5" />
            客户端配置指南
          </CardTitle>
          <CardDescription>在不同设备和浏览器上配置DoH服务</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Chrome浏览器 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600" />
              <h4 className="font-medium text-blue-900">Chrome / Edge浏览器</h4>
            </div>
            <ol className="space-y-2 text-sm text-blue-700 list-decimal list-inside pl-4">
              <li>打开浏览器设置 → 隐私和安全</li>
              <li>找到"使用安全DNS"选项</li>
              <li>选择"自定义"</li>
              <li>输入DoH地址: <code className="bg-blue-50 px-2 py-1 rounded text-xs">{dohEndpoint}</code></li>
              <li>保存设置</li>
            </ol>
          </div>

          <Separator />

          {/* Firefox浏览器 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-orange-600" />
              <h4 className="font-medium text-blue-900">Firefox浏览器</h4>
            </div>
            <ol className="space-y-2 text-sm text-blue-700 list-decimal list-inside pl-4">
              <li>打开设置 → 隐私与安全</li>
              <li>滚动到"通过HTTPS的DNS"部分</li>
              <li>选择"最大保护"</li>
              <li>点击"自定义"并输入DoH地址</li>
              <li>保存设置</li>
            </ol>
          </div>

          <Separator />

          {/* Android */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-green-600" />
              <h4 className="font-medium text-blue-900">Android 9+</h4>
            </div>
            <ol className="space-y-2 text-sm text-blue-700 list-decimal list-inside pl-4">
              <li>打开设置 → 网络和互联网</li>
              <li>点击"高级" → "私人DNS"</li>
              <li>选择"私人DNS提供商主机名"</li>
              <li>输入您的域名（不含https://）</li>
              <li>点击保存</li>
            </ol>
            <Alert>
              <AlertDescription className="text-xs">
                注意: Android原生设置使用DoT而非DoH，建议使用支持DoH的第三方应用
              </AlertDescription>
            </Alert>
          </div>

          <Separator />

          {/* iOS */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-blue-600" />
              <h4 className="font-medium text-blue-900">iOS 14+</h4>
            </div>
            <div className="text-sm text-blue-700 space-y-2">
              <p>iOS需要通过配置描述文件来设置DoH:</p>
              <ol className="space-y-2 list-decimal list-inside pl-4">
                <li>下载DoH配置描述文件（.mobileconfig）</li>
                <li>在Safari中打开文件</li>
                <li>前往设置 → 通用 → VPN与设备管理</li>
                <li>安装配置描述文件</li>
                <li>重启设备使设置生效</li>
              </ol>
            </div>
          </div>

          <Separator />

          {/* Windows */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Laptop className="w-5 h-5 text-blue-600" />
              <h4 className="font-medium text-blue-900">Windows 11</h4>
            </div>
            <ol className="space-y-2 text-sm text-blue-700 list-decimal list-inside pl-4">
              <li>打开设置 → 网络和Internet</li>
              <li>点击您的网络连接（Wi-Fi或以太网）</li>
              <li>找到DNS服务器设置</li>
              <li>选择"手动"并启用"通过HTTPS的DNS"</li>
              <li>输入DoH服务器地址</li>
              <li>保存设置</li>
            </ol>
          </div>

          <Separator />

          {/* 路由器 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Router className="w-5 h-5 text-purple-600" />
              <h4 className="font-medium text-blue-900">路由器配置</h4>
            </div>
            <div className="text-sm text-blue-700 space-y-2">
              <p>部分高级路由器支持DoH配置（如OpenWrt、梅林固件）:</p>
              <ol className="space-y-2 list-decimal list-inside pl-4">
                <li>登录路由器管理界面</li>
                <li>找到DNS或DHCP设置</li>
                <li>配置DoH客户端（如dnsmasq + https_dns_proxy）</li>
                <li>指向本服务的DoH端点</li>
                <li>重启DNS服务使配置生效</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 测试验证 */}
      <Card className="border-green-100 shadow-md bg-gradient-to-br from-green-50 to-white">
        <CardHeader>
          <CardTitle className="text-green-900">配置验证</CardTitle>
          <CardDescription>确认DoH服务是否正常工作</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-green-800">
          <p>配置完成后，可以通过以下方式验证:</p>
          <ol className="space-y-2 list-decimal list-inside pl-4">
            <li>访问DNS泄漏测试网站（如 dnsleaktest.com）</li>
            <li>检查是否显示您配置的DNS服务器</li>
            <li>使用本页面的"DNS查询"工具进行测试</li>
            <li>查看"日志统计"标签页确认查询记录</li>
          </ol>
        </CardContent>
      </Card>

      {/* 上游DNS服务器 */}
      <Card className="border-blue-100 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-blue-900">上游DNS服务器</CardTitle>
              <CardDescription>当前使用的上游DNS解析服务</CardDescription>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      fetchSettings();
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? '保存中...' : '保存'}
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="border-blue-200 hover:bg-blue-50"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  编辑
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {upstreamServers.map((server, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100"
              >
                {isEditing ? (
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 mr-3">
                    <div className="space-y-1">
                      <Label className="text-xs">名称</Label>
                      <Input
                        value={server.name}
                        onChange={(e) => updateServer(index, 'name', e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs">DoH URL</Label>
                      <Input
                        value={server.url}
                        onChange={(e) => updateServer(index, 'url', e.target.value)}
                        className="h-8"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${server.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div>
                      <p className="font-medium text-blue-900">{server.name}</p>
                      <p className="text-xs text-blue-600">{server.url}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500">优先级 {server.priority}</Badge>
                  {isEditing && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeServer(index)}
                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {isEditing && (
              <Button
                variant="outline"
                onClick={addServer}
                className="w-full border-dashed border-blue-300 hover:bg-blue-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                添加上游DNS服务器
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
