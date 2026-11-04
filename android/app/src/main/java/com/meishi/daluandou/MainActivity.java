package com.meishi.daluandou;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * 食灵月城 · 安卓壳（方案 A：在线 WebView）。
 * WebView 直接加载线上站 https://940608.site/，页面资源与 /api 全同源，零前端改动。
 * 本地优先存档走 WebView 的 localStorage（开启 DOM storage）。
 *
 * 启动连接策略：主文档加载失败时先自动重试（1s/2s/4s 退避，共 3 次）——
 * 冷启动瞬间网络栈/DNS/TLS 尚未就绪是「开局提示无网络、需多次手动重连」的根因；
 * 自动重试全部失败才展示离线引导页，离线页自身还会每 3 秒探测并自动回连。
 */
public class MainActivity extends Activity {

    private static final String START_URL = "https://940608.site/";
    private static final String OFFLINE_URL = "file:///android_asset/offline.html";
    private static final int MAX_AUTO_RETRIES = 3;

    private WebView web;
    private boolean offlineShown = false;
    private int autoRetries = 0;
    private final Handler retryHandler = new Handler(Looper.getMainLooper());

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 状态栏/导航栏融入游戏底色，避免启动白闪
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.parseColor("#0A1025"));
        getWindow().setNavigationBarColor(Color.parseColor("#0A1025"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0A1025"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // 本地优先存档（localStorage）
        s.setDatabaseEnabled(true);
        s.setTextZoom(100);                    // 屏蔽系统字体缩放对布局的破坏
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(true); // 环境音本就由用户交互触发
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();
                // 站内 http(s) 留在 WebView；外部协议交给系统
                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) { }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                offlineShown = OFFLINE_URL.equals(url);
                if (!offlineShown) {
                    autoRetries = 0; // 进站成功，重置自动重试计数
                    retryHandler.removeCallbacksAndMessages(null);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                // 仅主文档失败时自动重试；退避耗尽才展示离线引导页
                if (request.isForMainFrame()) {
                    scheduleAutoRetry();
                }
            }
        });

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(START_URL);
        }
    }

    /** 主文档失败后的自动重试：1s → 2s → 4s 退避，全部失败才进离线页。 */
    private void scheduleAutoRetry() {
        retryHandler.removeCallbacksAndMessages(null);
        if (autoRetries >= MAX_AUTO_RETRIES) {
            if (!OFFLINE_URL.equals(web.getUrl())) {
                web.loadUrl(OFFLINE_URL);
            }
            return;
        }
        long delayMs = 1000L << autoRetries; // 1000 / 2000 / 4000
        autoRetries += 1;
        retryHandler.postDelayed(() -> web.loadUrl(START_URL), delayMs);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // 返回键：WebView 可回退则回退；离线页则立即重试进站；否则走系统默认
        if (keyCode == KeyEvent.KEYCODE_BACK && web != null) {
            if (offlineShown) {
                offlineShown = false;
                autoRetries = 0;
                web.loadUrl(START_URL);
                return true;
            }
            if (web.canGoBack()) {
                web.goBack();
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        retryHandler.removeCallbacksAndMessages(null);
        if (web != null) {
            web.destroy();
        }
        super.onDestroy();
    }
}
