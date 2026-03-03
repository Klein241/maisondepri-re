plugins {
    id("com.android.application")
}

android {
    namespace = "com.maisondepriere.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.maisondepriere.app"
        minSdk = 23
        targetSdk = 34
        versionCode = 1
        versionName = "1.4.0"

        // ═══════════════════════════════════════════════════════════
        // 🔧 CONFIGURE YOUR DOMAIN HERE
        // Replace with your actual deployed URL
        // ═══════════════════════════════════════════════════════════
        manifestPlaceholders["hostName"] = "maisondepriere.netlify.app"
        // When you move to Cloudflare Pages, change to:
        // manifestPlaceholders["hostName"] = "maison-priere.pages.dev"
    }

    signingConfigs {
        create("release") {
            // ═══════════════════════════════════════════════════════
            // 🔑 CONFIGURE SIGNING FOR PLAY STORE
            // Generate a keystore:
            //   keytool -genkey -v -keystore maisondepriere.keystore \
            //     -alias maisondepriere -keyalg RSA -keysize 2048 -validity 36500
            //
            // Then fill in these values:
            // ═══════════════════════════════════════════════════════
            // storeFile = file("maisondepriere.keystore")
            // storePassword = "YOUR_STORE_PASSWORD"
            // keyAlias = "maisondepriere"
            // keyPassword = "YOUR_KEY_PASSWORD"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // signingConfig = signingConfigs.getByName("release")
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // ══════════════════════════════════════════════════════════════
    // Google Android Browser Helper — OFFICIAL TWA library
    // This is the same library used by Twitter Lite, Starbucks, etc.
    // ══════════════════════════════════════════════════════════════
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")

    // Firebase Cloud Messaging for push notifications (optional)
    // implementation("com.google.firebase:firebase-messaging:24.0.0")
}
