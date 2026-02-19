'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Globe, Book, Smartphone, Laptop, Router, Plus, Trash2, Save, Key, User, ChevronDown, ChevronUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UpstreamServer {
  name: string;
  url: string;
  priority: number;
  enabled: boolean;
}

interface AuthSettings {
  username: string;
}

interface SettingsData {
  upstreamServers: UpstreamServer[];
  auth: AuthSettings;
  storageType: string;
}

export function ConfigurationPanel() {
  const [upstreamServers, setUpstreamServers] = useState<UpstreamServer[]>([]);
  const [authSettings, setAuthSettings] = useState<AuthSettings>({ username: '' });
  const [storageType, setStorageType] = useState<string>('memory');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    auth: true,
    endpoint: true,
    guide: false,
    upstream: true,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data: SettingsData = await response.json();
      setUpstreamServers(data.upstreamServers || []);
      setAuthSettings(data.auth || { username: '' });
      setNewUsername(data.auth?.username || '');
      setStorageType(data.storageType || 'memory');
    } catch (error) {
      console.error('获取设置失败:', error);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
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

  const handlePasswordChange = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!newUsername.trim()) {
      setPasswordError('用户名不能为空');
      return;
    }

    if (!newPassword) {
      setPasswordError('请输入新密码');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('密码长度至少6位');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的密码不一致');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth: {
            username: newUsername,
            password: newPassword,
          },
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setPasswordSuccess('登录凭证已更新，下次登录生效');
        setNewPassword('');
        setConfirmPassword('');
        setAuthSettings({ username: newUsername });
      } else {
        setPasswordError(data.error || '更新失败');
      }
    } catch (error) {
      setPasswordError('网络错误，请稍后重试');
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
    <div className="space-y-4 sm:space-y-6">
      {/* 认证设置 */}
      <Card className="border-blue-100 shadow-md">
        <CardHeader className="cursor-pointer" onClick={() => toggleSection('auth')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-blue-900 text-base sm:text-lg">登录凭证设置</CardTitle>
            </div>
            {expandedSections.auth ? <ChevronUp className="w-5 h-5 text-blue-400" /> : <ChevronDown className="w-5 h-5 text-blue-400" />}
          </div>
          <CardDescription>修改管理后台登录用户名和密码</CardDescription>
        </CardHeader>
        {expandedSections.auth && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="输入用户名"
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="current-username">当前用户名</Label>
                <Input
                  id="current-username"
                  value={authSettings.username}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">新密码</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="输入新密码（至少6位）"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">确认密码</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入新密码"
                />
              </div>
            </div>

            {passwordError && (
              <Alert variant="destructive">
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}

            {passwordSuccess && (
              <Alert className="bg-green-50 border-green-200">
                <AlertDescription className="text-green-700">{passwordSuccess}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button
                onClick={handlePasswordChange}
                disabled={isSaving}
                className="bg-blue-500 hover:bg-blue-600 w-full sm:w-auto"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? '保存中...' : '保存凭证'}
              </Button>

              <div className="text-xs text-muted-foreground">
                存储模式: <Badge variant="outline" className="ml-1">{storageType === 'kv' ? 'Vercel KV' : storageType === 'redis' ? 'Redis' : '内存（重启丢失）'}</Badge>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* DoH端点信息 */}
      <Card className="border-blue-100 shadow-md">
        <CardHeader className="cursor-pointer" onClick={() => toggleSection('endpoint')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-blue-900 text-base sm:text-lg">DoH服务端点配置</CardTitle>
            </div>
            {expandedSections.endpoint ? <ChevronUp className="w-5 h-5 text-blue-400" /> : <ChevronDown className="w-5 h-5 text-blue-400" />}
          </div>
          <CardDescription>DNS over HTTPS (DoH)服务的连接信息</CardDescription>
        </CardHeader>
        {expandedSections.endpoint && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">服务地址:</span>
                <Badge className="bg-blue-500">RFC 8484标准</Badge>
              </div>
              <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                <code className="text-xs sm:text-sm text-blue-900 break-all font-mono">
                  {dohEndpoint}
                </code>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-blue-900">支持的请求方式</h4>
                <ul className="space-y-2 text-sm text-blue-700">
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="mt-0.5 shrink-0">GET</Badge>
                    <span>支持Base64URL编码的DNS查询</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="mt-0.5 shrink-0">POST</Badge>
                    <span>支持DNS wire format请求体</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-blue-900">Content-Type</h4>
                <div className="p-2 bg-blue-50 rounded border border-blue-100">
                  <code className="text-sm text-blue-900">application/dns-message</code>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 配置指南 */}
      <Card className="border-blue-100 shadow-md">
        <CardHeader className="cursor-pointer" onClick={() => toggleSection('guide')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Book className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-blue-900 text-base sm:text-lg">客户端配置指南</CardTitle>
            </div>
            {expandedSections.guide ? <ChevronUp className="w-5 h-5 text-blue-400" /> : <ChevronDown className="w-5 h-5 text-blue-400" />}
          </div>
          <CardDescription>在不同设备和浏览器上配置DoH服务</CardDescription>
        </CardHeader>
        {expandedSections.guide && (
          <CardContent className="space-y-4 sm:space-y-6">
            {/* Chrome浏览器 */}
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                <h4 className="font-medium text-blue-900 text-sm sm:text-base">Chrome / Edge浏览器</h4>
              </div>
              <ol className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-blue-700 list-decimal list-inside pl-2">
                <li>打开浏览器设置 → 隐私和安全</li>
                <li>找到"使用安全DNS"选项</li>
                <li>选择"自定义"</li>
                <li>输入DoH地址</li>
                <li>保存设置</li>
              </ol>
            </div>

            <Separator />

            {/* Firefox浏览器 */}
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                <h4 className="font-medium text-blue-900 text-sm sm:text-base">Firefox浏览器</h4>
              </div>
              <ol className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-blue-700 list-decimal list-inside pl-2">
                <li>打开设置 → 隐私与安全</li>
                <li>滚动到"通过HTTPS的DNS"部分</li>
                <li>选择"最大保护"</li>
                <li>点击"自定义"并输入DoH地址</li>
                <li>保存设置</li>
              </ol>
            </div>

            <Separator />

            {/* Android */}
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                <h4 className="font-medium text-blue-900 text-sm sm:text-base">Android 9+</h4>
              </div>
              <ol className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-blue-700 list-decimal list-inside pl-2">
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
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                <h4 className="font-medium text-blue-900 text-sm sm:text-base">iOS 14+</h4>
              </div>
              <div className="text-xs sm:text-sm text-blue-700 space-y-1 sm:space-y-2">
                <p>iOS需要通过配置描述文件来设置DoH:</p>
                <ol className="space-y-1 sm:space-y-2 list-decimal list-inside pl-2">
                  <li>下载DoH配置描述文件</li>
                  <li>在Safari中打开文件</li>
                  <li>前往设置 → 通用 → VPN与设备管理</li>
                  <li>安装配置描述文件</li>
                  <li>重启设备使设置生效</li>
                </ol>
              </div>
            </div>

            <Separator />

            {/* Windows */}
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                <h4 className="font-medium text-blue-900 text-sm sm:text-base">Windows 11</h4>
              </div>
              <ol className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-blue-700 list-decimal list-inside pl-2">
                <li>打开设置 → 网络和Internet</li>
                <li>点击您的网络连接</li>
                <li>找到DNS服务器设置</li>
                <li>选择"手动"并启用"通过HTTPS的DNS"</li>
                <li>输入DoH服务器地址</li>
              </ol>
            </div>

            <Separator />

            {/* 路由器 */}
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2">
                <Router className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                <h4 className="font-medium text-blue-900 text-sm sm:text-base">路由器配置</h4>
              </div>
              <div className="text-xs sm:text-sm text-blue-700 space-y-1 sm:space-y-2">
                <p>部分高级路由器支持DoH配置:</p>
                <ol className="space-y-1 sm:space-y-2 list-decimal list-inside pl-2">
                  <li>登录路由器管理界面</li>
                  <li>找到DNS或DHCP设置</li>
                  <li>配置DoH客户端</li>
                  <li>指向本服务的DoH端点</li>
                  <li>重启DNS服务</li>
                </ol>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 测试验证 */}
      <Card className="border-green-100 shadow-md bg-gradient-to-br from-green-50 to-white">
        <CardHeader>
          <CardTitle className="text-green-900 text-base sm:text-lg">配置验证</CardTitle>
          <CardDescription>确认DoH服务是否正常工作</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-green-800">
          <p>配置完成后，可以通过以下方式验证:</p>
          <ol className="space-y-1 sm:space-y-2 list-decimal list-inside pl-2">
            <li>访问DNS泄漏测试网站（如 dnsleaktest.com）</li>
            <li>检查是否显示您配置的DNS服务器</li>
            <li>使用本页面的"DNS查询"工具进行测试</li>
            <li>查看"日志统计"标签页确认查询记录</li>
          </ol>
        </CardContent>
      </Card>

      {/* 上游DNS服务器 */}
      <Card className="border-blue-100 shadow-md">
        <CardHeader className="cursor-pointer" onClick={() => toggleSection('upstream')}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-blue-900 text-base sm:text-lg">上游DNS服务器</CardTitle>
              <CardDescription>当前使用的上游DNS解析服务</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {expandedSections.upstream ? <ChevronUp className="w-5 h-5 text-blue-400" /> : <ChevronDown className="w-5 h-5 text-blue-400" />}
            </div>
          </div>
        </CardHeader>
        {expandedSections.upstream && (
          <CardContent>
            {isEditing && (
              <div className="flex gap-2 mb-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    fetchSettings();
                  }}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-blue-500 hover:bg-blue-600 flex-1"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? '保存中...' : '保存'}
                </Button>
              </div>
            )}

            <div className="space-y-3">
              {upstreamServers.map((server, index) => (
                <div
                  key={index}
                  className="p-3 bg-blue-50 rounded-lg border border-blue-100"
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">名称</Label>
                          <Input
                            value={server.name}
                            onChange={(e) => updateServer(index, 'name', e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">优先级</Label>
                          <Input
                            type="number"
                            value={server.priority}
                            onChange={(e) => updateServer(index, 'priority', parseInt(e.target.value))}
                            className="h-9"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">DoH URL</Label>
                        <Input
                          value={server.url}
                          onChange={(e) => updateServer(index, 'url', e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={server.enabled}
                            onChange={(e) => updateServer(index, 'enabled', e.target.checked)}
                            className="w-4 h-4"
                          />
                          启用
                        </label>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeServer(index)}
                          className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          删除
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${server.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-blue-900 truncate">{server.name}</p>
                          <p className="text-xs text-blue-600 truncate">{server.url}</p>
                        </div>
                      </div>
                      <Badge className="bg-blue-500 shrink-0 ml-2">优先级 {server.priority}</Badge>
                    </div>
                  )}
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

              {!isEditing && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="w-full border-blue-200 hover:bg-blue-50"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  编辑服务器配置
                </Button>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
