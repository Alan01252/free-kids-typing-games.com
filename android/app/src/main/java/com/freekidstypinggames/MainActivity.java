package com.freekidstypinggames;

import android.net.Uri;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onBackPressed() {
    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView != null && webView.canGoBack()) {
      webView.goBack();
      return;
    }
    if (webView != null) {
      String currentUrl = webView.getUrl();
      if (currentUrl != null) {
        Uri uri = Uri.parse(currentUrl);
        String path = uri.getPath();
        if (path != null && path.startsWith("/games/")) {
          webView.loadUrl("https://free-kids-typing-games.com/");
          return;
        }
      }
    }
    super.onBackPressed();
  }
}
