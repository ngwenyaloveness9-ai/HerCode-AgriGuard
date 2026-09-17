#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <DHT.h>

// =====================================================
//                 AGRIGUARD 3D
//       ESP32 + Firebase Realtime Database
// =====================================================

// ---------------- WIFI ----------------

#define WIFI_SSID "Samsung Galaxy A24"
#define WIFI_PASSWORD "@Somuhle123"

// ---------------- FIREBASE ----------------
//
// Get these from Firebase.
// API_KEY is the Web API Key from your Firebase project.
//
// DATABASE_URL should look like:
// https://agriguard-211eb-default-rtdb.firebaseio.com/
//

#define API_KEY "AIzaSyDnnoTgvzkPPPw_NzFQt6nf2hqJD3uWTow"

#define DATABASE_URL "https://agriguard-211eb-default-rtdb.firebaseio.com/"

// ---------------- SOIL SENSORS ----------------

#define ZONE_A_PIN 34
#define ZONE_B_PIN 35
#define ZONE_C_PIN 32

// ---------------- DHT11 ----------------

#define DHT_PIN 4
#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);

// ---------------- FIREBASE OBJECTS ----------------

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

bool signupOK = false;

// =====================================================
//                    CONNECT WIFI
// =====================================================

void connectWiFi() {

  Serial.println();
  Serial.println("Connecting to WiFi...");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 30) {

    delay(500);
    Serial.print(".");

    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println();
    Serial.println("WiFi connected!");

    Serial.print("ESP32 IP Address: ");
    Serial.println(WiFi.localIP());

  } else {

    Serial.println();
    Serial.println("WiFi connection failed!");
  }
}

// =====================================================
//                   CONNECT FIREBASE
// =====================================================

void connectFirebase() {

  Serial.println();
  Serial.println("Connecting to Firebase...");

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  /*
     Anonymous Firebase authentication.

     Firebase Authentication must have
     Anonymous Sign-In enabled.
  */

  if (Firebase.signUp(&config, &auth, "", "")) {

    Serial.println("Firebase authentication successful.");

    signupOK = true;

  } else {

    Serial.print("Firebase authentication error: ");

    Serial.println(
      config.signer.signupError.message.c_str()
    );
  }

  Firebase.begin(&config, &auth);

  Firebase.reconnectWiFi(true);
}

// =====================================================
//                         SETUP
// =====================================================

void setup() {

  Serial.begin(115200);

  delay(1000);

  // ESP32 ADC resolution
  analogReadResolution(12);

  // Start DHT11
  dht.begin();

  Serial.println();
  Serial.println("========================================");
  Serial.println("              AGRIGUARD 3D");
  Serial.println("========================================");
  Serial.println("Zone A Soil Moisture");
  Serial.println("Zone B Soil Moisture");
  Serial.println("Zone C Soil Moisture");
  Serial.println("Temperature");
  Serial.println("Humidity");
  Serial.println("Firebase Realtime Database");
  Serial.println("========================================");

  // Connect ESP32 to WiFi
  connectWiFi();

  // Connect to Firebase
  connectFirebase();
}

// =====================================================
//                         LOOP
// =====================================================

void loop() {

  // ---------------------------------------------------
  // READ SOIL MOISTURE
  // ---------------------------------------------------

  int zoneA = analogRead(ZONE_A_PIN);
  int zoneB = analogRead(ZONE_B_PIN);
  int zoneC = analogRead(ZONE_C_PIN);

  // ---------------------------------------------------
  // READ TEMPERATURE + HUMIDITY
  // ---------------------------------------------------

  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  // ---------------------------------------------------
  // SERIAL MONITOR
  // ---------------------------------------------------

  Serial.println();
  Serial.println("----------------------------------------");

  Serial.print("Zone A: ");
  Serial.println(zoneA);

  Serial.print("Zone B: ");
  Serial.println(zoneB);

  Serial.print("Zone C: ");
  Serial.println(zoneC);

  if (isnan(temperature) || isnan(humidity)) {

    Serial.println("DHT11: READ FAILED");

  } else {

    Serial.print("Temperature: ");
    Serial.print(temperature, 1);
    Serial.println(" C");

    Serial.print("Humidity: ");
    Serial.print(humidity, 1);
    Serial.println(" %");
  }

  // ---------------------------------------------------
  // SEND DATA TO FIREBASE
  // ---------------------------------------------------

  if (
      Firebase.ready() &&
      signupOK &&
      WiFi.status() == WL_CONNECTED
  ) {

    bool success = true;

    // Zone A
    if (!Firebase.RTDB.setInt(
          &fbdo,
          "/agriguard/zones/zoneA/moistureRaw",
          zoneA
        )) {

      success = false;

      Serial.print("Zone A Firebase error: ");
      Serial.println(fbdo.errorReason());
    }

    // Zone B
    if (!Firebase.RTDB.setInt(
          &fbdo,
          "/agriguard/zones/zoneB/moistureRaw",
          zoneB
        )) {

      success = false;

      Serial.print("Zone B Firebase error: ");
      Serial.println(fbdo.errorReason());
    }

    // Zone C
    if (!Firebase.RTDB.setInt(
          &fbdo,
          "/agriguard/zones/zoneC/moistureRaw",
          zoneC
        )) {

      success = false;

      Serial.print("Zone C Firebase error: ");
      Serial.println(fbdo.errorReason());
    }

    // Only send DHT readings when valid
    if (!isnan(temperature) && !isnan(humidity)) {

      if (!Firebase.RTDB.setFloat(
            &fbdo,
            "/agriguard/environment/temperature",
            temperature
          )) {

        success = false;

        Serial.print("Temperature Firebase error: ");
        Serial.println(fbdo.errorReason());
      }

      if (!Firebase.RTDB.setFloat(
            &fbdo,
            "/agriguard/environment/humidity",
            humidity
          )) {

        success = false;

        Serial.print("Humidity Firebase error: ");
        Serial.println(fbdo.errorReason());
      }
    }

    // Device status
    Firebase.RTDB.setBool(
      &fbdo,
      "/agriguard/system/esp32Online",
      true
    );

    if (success) {

      Serial.println("Firebase: DATA SENT SUCCESSFULLY");

    } else {

      Serial.println("Firebase: SOME DATA FAILED");
    }

  } else {

    Serial.println("Firebase: NOT READY");
  }

  // ---------------------------------------------------
  // SEND EVERY 3 SECONDS
  // ---------------------------------------------------

  delay(3000);
}