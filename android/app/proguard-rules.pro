# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Capacitor discovers native plugins through reflection. Preserve its bridge and
# explicitly annotated plugin entry points while allowing R8 to shrink the rest.
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }

# Any JavaScript bridge method must remain callable by Android WebView.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Plugin annotations are required by the Capacitor runtime at startup.
-keepattributes RuntimeVisibleAnnotations,RuntimeInvisibleAnnotations

# Facebook Login is an optional provider referenced by the Firebase
# Authentication plugin. The application does not bundle that provider, so R8
# may safely ignore these absent classes while it continues to shrink release.
-dontwarn com.facebook.CallbackManager$Factory
-dontwarn com.facebook.CallbackManager
-dontwarn com.facebook.FacebookCallback
-dontwarn com.facebook.login.LoginManager
-dontwarn com.facebook.login.widget.LoginButton
