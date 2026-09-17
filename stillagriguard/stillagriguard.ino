#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <DHT.h>

// =====================================================
//                 AGRIGUARD 3D
//     ESP32 + Firebase + Sensors + Water Pump
//     + Farm + Owner + Zone Identification
// =====================================================


// =====================================================
// WIFI
// =====================================================

#define WIFI_SSID "Samsung Galaxy A24"
#define WIFI_PASSWORD "@Somuhle123"


// =====================================================
// FIREBASE
// =====================================================

#define API_KEY "AIzaSyDnnoTgvzkPPPw_NzFQt6nf2hqJD3uWTow"

#define DATABASE_URL \
"https://agriguard-211eb-default-rtdb.firebaseio.com/"


// =====================================================
// FARM CONFIGURATION
// =====================================================
//
// IMPORTANT:
//
// OWNER_ID must be the Firebase Authentication UID of
// the owner who is logged into the AgriGuard dashboard.
//
// Do NOT put the owner's password here.
//
// The farm ID stays constant so that every reading from
// this ESP32 can be associated with the same farm.
//

#define FARM_ID "agriguard-farm-001"
#define FARM_NAME "AgriGuard Farm"

// Replace this with the real Firebase Authentication UID
// of the farm owner.
#define OWNER_ID "REPLACE_WITH_FIREBASE_OWNER_UID"

#define DEVICE_ID "agriguard-esp32-001"
#define DEVICE_NAME "AgriGuard ESP32"


// =====================================================
// FIELD CONFIGURATION
// =====================================================

#define FIELD_ID "agriguard-field-001"
#define FIELD_NAME "AgriGuard Demonstration Field"


// =====================================================
// ZONE CONFIGURATION
// =====================================================

#define ZONE_A_ID "zoneA"
#define ZONE_A_NAME "Zone A"
#define ZONE_A_CROP "Macadamia"

#define ZONE_B_ID "zoneB"
#define ZONE_B_NAME "Zone B"
#define ZONE_B_CROP "Macadamia"

#define ZONE_C_ID "zoneC"
#define ZONE_C_NAME "Zone C"
#define ZONE_C_CROP "Citrus"


// =====================================================
// SOIL MOISTURE SENSORS
// =====================================================

#define ZONE_A_PIN 34
#define ZONE_B_PIN 35
#define ZONE_C_PIN 32


// =====================================================
// DHT11
// =====================================================

#define DHT_PIN 4
#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);


// =====================================================
// WATER PUMP RELAY
// =====================================================
//
// ESP32 GPIO27 -> Relay IN
//
// ACTIVE-LOW relay:
//
// LOW  = Relay ON
// HIGH = Relay OFF
//

#define PUMP_RELAY_PIN 27

#define RELAY_ON  LOW
#define RELAY_OFF HIGH

bool pumpRunning = false;


// =====================================================
// FIREBASE OBJECTS
// =====================================================

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

bool signupOK = false;


// =====================================================
// TIMING
// =====================================================

unsigned long lastFirebaseUpdate = 0;

const unsigned long FIREBASE_INTERVAL = 3000;


// =====================================================
// FARM CONFIGURATION SENT FLAG
// =====================================================
//
// Farm metadata does not need to be rewritten every
// 3 seconds.
//
// It is written once after Firebase becomes available.
//

bool farmConfigurationSent = false;


// =====================================================
// WATER PUMP ON
// =====================================================

void pumpON() {

  digitalWrite(
    PUMP_RELAY_PIN,
    RELAY_ON
  );

  pumpRunning = true;

  Serial.println();
  Serial.println(
    "========================================"
  );

  Serial.println(
    "          WATER PUMP ON"
  );

  Serial.println(
    "========================================"
  );
}


// =====================================================
// WATER PUMP OFF
// =====================================================

void pumpOFF() {

  digitalWrite(
    PUMP_RELAY_PIN,
    RELAY_OFF
  );

  pumpRunning = false;

  Serial.println();
  Serial.println(
    "========================================"
  );

  Serial.println(
    "          WATER PUMP OFF"
  );

  Serial.println(
    "========================================"
  );
}


// =====================================================
// CONNECT WIFI
// =====================================================

void connectWiFi() {

  Serial.println();
  Serial.println(
    "Connecting to WiFi..."
  );

  WiFi.begin(
    WIFI_SSID,
    WIFI_PASSWORD
  );

  int attempts = 0;

  while (
    WiFi.status() != WL_CONNECTED &&
    attempts < 30
  ) {

    delay(500);

    Serial.print(".");

    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println();

    Serial.println(
      "WiFi connected!"
    );

    Serial.print(
      "ESP32 IP Address: "
    );

    Serial.println(
      WiFi.localIP()
    );

  } else {

    Serial.println();

    Serial.println(
      "WiFi connection failed!"
    );
  }
}


// =====================================================
// CONNECT FIREBASE
// =====================================================

void connectFirebase() {

  Serial.println();

  Serial.println(
    "Connecting to Firebase..."
  );

  config.api_key = API_KEY;

  config.database_url = DATABASE_URL;


  // ---------------------------------------------------
  // Anonymous authentication
  // ---------------------------------------------------

  if (
    Firebase.signUp(
      &config,
      &auth,
      "",
      ""
    )
  ) {

    Serial.println(
      "Firebase authentication successful."
    );

    signupOK = true;

  } else {

    Serial.print(
      "Firebase authentication error: "
    );

    Serial.println(
      config.signer.signupError.message.c_str()
    );
  }


  Firebase.begin(
    &config,
    &auth
  );

  Firebase.reconnectWiFi(true);
}


// =====================================================
// CREATE / UPDATE FARM CONFIGURATION
// =====================================================
//
// This adds the identity information needed to associate
// the physical ESP32 installation with:
//
// Owner
//   -> Farm
//      -> Field
//         -> Zone A
//         -> Zone B
//         -> Zone C
//
// Existing sensor paths are NOT removed.
// =====================================================

bool sendFarmConfiguration() {

  Serial.println();

  Serial.println(
    "========================================"
  );

  Serial.println(
    "     SENDING FARM CONFIGURATION"
  );

  Serial.println(
    "========================================"
  );

  bool success = true;


  // ===================================================
  // FARM
  // ===================================================

  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/farm/id",
      FARM_ID
    )
  ) {
    success = false;
  }


  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/farm/name",
      FARM_NAME
    )
  ) {
    success = false;
  }


  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/farm/ownerId",
      OWNER_ID
    )
  ) {
    success = false;
  }


  // ===================================================
  // FIELD
  // ===================================================

  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/field/id",
      FIELD_ID
    )
  ) {
    success = false;
  }


  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/field/name",
      FIELD_NAME
    )
  ) {
    success = false;
  }


  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/field/farmId",
      FARM_ID
    )
  ) {
    success = false;
  }


  // ===================================================
  // DEVICE
  // ===================================================

  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/device/id",
      DEVICE_ID
    )
  ) {
    success = false;
  }


  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/device/name",
      DEVICE_NAME
    )
  ) {
    success = false;
  }


  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/device/farmId",
      FARM_ID
    )
  ) {
    success = false;
  }


  // ===================================================
  // ZONE A CONFIGURATION
  // ===================================================

  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/zones/zoneA/id",
      ZONE_A_ID
    )
  ) {
    success = false;
  }


  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/zones/zoneA/name",
      ZONE_A_NAME
    )
  ) {
    success = false;
  }


  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/zones/zoneA/crop",
      ZONE_A_CROP
    )
  ) {
    success = false;
  }


  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/zones/zoneA/farmId",
      FARM_ID
    )
  ) {
    success = false;
  }


  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/zones/zoneA/fieldId",
      FIELD_ID
    )
  ) {
    success = false;
  }


  // ===================================================
  // ZONE B CONFIGURATION
  // ===================================================

  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/zones/zoneB/id",
      ZONE_B_ID
    )
  ) {
    success = false;
  }


  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/zones/zoneB/name",
      ZONE_B_NAME
    )
  ) {
    success = false;
  }


  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/zones/zoneB/crop",
      ZONE_B_CROP
    )
  ) {
    success = false;
  }


  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/zones/zoneB/farmId",
      FARM_ID
    )
  ) {
    success = false;
  }


  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/zones/zoneB/fieldId",
      FIELD_ID
    )
  ) {
    success = false;
  }


  // ===================================================
  // ZONE C CONFIGURATION
  // ===================================================

  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/zones/zoneC/id",
      ZONE_C_ID
    )
  ) {
    success = false;
  }


  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/zones/zoneC/name",
      ZONE_C_NAME
    )
  ) {
    success = false;
  }


  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/zones/zoneC/crop",
      ZONE_C_CROP
    )
  ) {
    success = false;
  }


  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/zones/zoneC/farmId",
      FARM_ID
    )
  ) {
    success = false;
  }


  if (
    !Firebase.RTDB.setString(
      &fbdo,
      "/agriguard/zones/zoneC/fieldId",
      FIELD_ID
    )
  ) {
    success = false;
  }


  // ===================================================
  // RESULT
  // ===================================================

  if (success) {

    Serial.println(
      "Farm configuration sent successfully."
    );

    Serial.print(
      "Farm ID: "
    );

    Serial.println(
      FARM_ID
    );

    Serial.print(
      "Farm Name: "
    );

    Serial.println(
      FARM_NAME
    );

    Serial.print(
      "Owner ID: "
    );

    Serial.println(
      OWNER_ID
    );

  } else {

    Serial.print(
      "Farm configuration error: "
    );

    Serial.println(
      fbdo.errorReason()
    );
  }


  Serial.println(
    "========================================"
  );

  return success;
}


// =====================================================
// SERIAL COMMANDS
// =====================================================

void checkSerialCommands() {

  if (Serial.available() <= 0) {
    return;
  }

  char command = Serial.read();


  // ---------------------------------------------------
  // PUMP ON
  // ---------------------------------------------------

  if (command == '1') {

    pumpON();
  }


  // ---------------------------------------------------
  // PUMP OFF
  // ---------------------------------------------------

  else if (command == '2') {

    pumpOFF();
  }


  // ---------------------------------------------------
  // STATUS
  // ---------------------------------------------------

  else if (
    command == 'S' ||
    command == 's'
  ) {

    Serial.println();

    Serial.print(
      "Pump status: "
    );

    if (pumpRunning) {

      Serial.println(
        "ON"
      );

    } else {

      Serial.println(
        "OFF"
      );
    }
  }
}


// =====================================================
// SETUP
// =====================================================

void setup() {

  Serial.begin(115200);

  delay(1000);


  // ===================================================
  // ADC
  // ===================================================

  analogReadResolution(12);


  // ===================================================
  // DHT11
  // ===================================================

  dht.begin();


  // ===================================================
  // PUMP RELAY
  // ===================================================

  pinMode(
    PUMP_RELAY_PIN,
    OUTPUT
  );


  // Pump starts OFF
  digitalWrite(
    PUMP_RELAY_PIN,
    RELAY_OFF
  );

  pumpRunning = false;


  // ===================================================
  // STARTUP DISPLAY
  // ===================================================

  Serial.println();

  Serial.println(
    "========================================"
  );

  Serial.println(
    "              AGRIGUARD 3D"
  );

  Serial.println(
    "========================================"
  );

  Serial.print(
    "Farm: "
  );

  Serial.println(
    FARM_NAME
  );

  Serial.print(
    "Farm ID: "
  );

  Serial.println(
    FARM_ID
  );

  Serial.print(
    "Device: "
  );

  Serial.println(
    DEVICE_ID
  );

  Serial.println(
    "Zone A Soil Moisture"
  );

  Serial.println(
    "Zone B Soil Moisture"
  );

  Serial.println(
    "Zone C Soil Moisture"
  );

  Serial.println(
    "Temperature"
  );

  Serial.println(
    "Humidity"
  );

  Serial.println(
    "Water Pump"
  );

  Serial.println(
    "Firebase Realtime Database"
  );

  Serial.println(
    "========================================"
  );


  Serial.println();

  Serial.println(
    "PUMP CONTROL:"
  );

  Serial.println(
    "1 = Pump ON"
  );

  Serial.println(
    "2 = Pump OFF"
  );

  Serial.println(
    "S = Pump Status"
  );

  Serial.println(
    "========================================"
  );


  // ===================================================
  // WIFI
  // ===================================================

  connectWiFi();


  // ===================================================
  // FIREBASE
  // ===================================================

  connectFirebase();
}


// =====================================================
// LOOP
// =====================================================

void loop() {

  // ===================================================
  // CHECK PUMP COMMANDS
  // ===================================================

  checkSerialCommands();


  // ===================================================
  // READ SOIL MOISTURE
  // ===================================================

  int zoneA =
    analogRead(ZONE_A_PIN);

  int zoneB =
    analogRead(ZONE_B_PIN);

  int zoneC =
    analogRead(ZONE_C_PIN);


  // ===================================================
  // READ TEMPERATURE + HUMIDITY
  // ===================================================

  float humidity =
    dht.readHumidity();

  float temperature =
    dht.readTemperature();


  // ===================================================
  // SERIAL MONITOR
  // ===================================================

  Serial.println();

  Serial.println(
    "----------------------------------------"
  );


  Serial.print(
    "Zone A: "
  );

  Serial.println(
    zoneA
  );


  Serial.print(
    "Zone B: "
  );

  Serial.println(
    zoneB
  );


  Serial.print(
    "Zone C: "
  );

  Serial.println(
    zoneC
  );


  // ===================================================
  // DHT11 DISPLAY
  // ===================================================

  if (
    isnan(temperature) ||
    isnan(humidity)
  ) {

    Serial.println(
      "DHT11: READ FAILED"
    );

  } else {

    Serial.print(
      "Temperature: "
    );

    Serial.print(
      temperature,
      1
    );

    Serial.println(
      " C"
    );


    Serial.print(
      "Humidity: "
    );

    Serial.print(
      humidity,
      1
    );

    Serial.println(
      " %"
    );
  }


  // ===================================================
  // PUMP DISPLAY
  // ===================================================

  Serial.print(
    "Water Pump: "
  );


  if (pumpRunning) {

    Serial.println(
      "ON"
    );

  } else {

    Serial.println(
      "OFF"
    );
  }


  // ===================================================
  // FIREBASE UPDATE
  // ===================================================

  if (
    millis() - lastFirebaseUpdate >=
    FIREBASE_INTERVAL
  ) {

    lastFirebaseUpdate = millis();


    if (
      Firebase.ready() &&
      signupOK &&
      WiFi.status() == WL_CONNECTED
    ) {

      bool success = true;


      // ===============================================
      // CREATE FARM CONFIGURATION ONCE
      // ===============================================

      if (!farmConfigurationSent) {

        farmConfigurationSent =
          sendFarmConfiguration();
      }


      // ===============================================
      // ZONE A
      // ===============================================

      if (
        !Firebase.RTDB.setInt(
          &fbdo,
          "/agriguard/zones/zoneA/moistureRaw",
          zoneA
        )
      ) {

        success = false;

        Serial.print(
          "Zone A Firebase error: "
        );

        Serial.println(
          fbdo.errorReason()
        );
      }


      // ===============================================
      // ZONE B
      // ===============================================

      if (
        !Firebase.RTDB.setInt(
          &fbdo,
          "/agriguard/zones/zoneB/moistureRaw",
          zoneB
        )
      ) {

        success = false;

        Serial.print(
          "Zone B Firebase error: "
        );

        Serial.println(
          fbdo.errorReason()
        );
      }


      // ===============================================
      // ZONE C
      // ===============================================

      if (
        !Firebase.RTDB.setInt(
          &fbdo,
          "/agriguard/zones/zoneC/moistureRaw",
          zoneC
        )
      ) {

        success = false;

        Serial.print(
          "Zone C Firebase error: "
        );

        Serial.println(
          fbdo.errorReason()
        );
      }


      // ===============================================
      // TEMPERATURE + HUMIDITY
      // ===============================================

      if (
        !isnan(temperature) &&
        !isnan(humidity)
      ) {

        if (
          !Firebase.RTDB.setFloat(
            &fbdo,
            "/agriguard/environment/temperature",
            temperature
          )
        ) {

          success = false;
        }


        if (
          !Firebase.RTDB.setFloat(
            &fbdo,
            "/agriguard/environment/humidity",
            humidity
          )
        ) {

          success = false;
        }
      }


      // ===============================================
      // ATTACH FARM ID TO ENVIRONMENT
      // ===============================================

      if (
        !Firebase.RTDB.setString(
          &fbdo,
          "/agriguard/environment/farmId",
          FARM_ID
        )
      ) {

        success = false;
      }


      // ===============================================
      // PUMP STATE
      // ===============================================

      if (
        !Firebase.RTDB.setBool(
          &fbdo,
          "/agriguard/irrigation/pumpOn",
          pumpRunning
        )
      ) {

        success = false;

        Serial.print(
          "Pump Firebase error: "
        );

        Serial.println(
          fbdo.errorReason()
        );
      }


      // ===============================================
      // IRRIGATION FARM
      // ===============================================

      if (
        !Firebase.RTDB.setString(
          &fbdo,
          "/agriguard/irrigation/farmId",
          FARM_ID
        )
      ) {

        success = false;
      }


      // ===============================================
      // ESP32 STATUS
      // ===============================================

      if (
        !Firebase.RTDB.setBool(
          &fbdo,
          "/agriguard/system/esp32Online",
          true
        )
      ) {

        success = false;
      }


      // ===============================================
      // SYSTEM FARM / DEVICE
      // ===============================================

      if (
        !Firebase.RTDB.setString(
          &fbdo,
          "/agriguard/system/farmId",
          FARM_ID
        )
      ) {

        success = false;
      }


      if (
        !Firebase.RTDB.setString(
          &fbdo,
          "/agriguard/system/deviceId",
          DEVICE_ID
        )
      ) {

        success = false;
      }


      // ===============================================
      // RESULT
      // ===============================================

      if (success) {

        Serial.println(
          "Firebase: DATA SENT SUCCESSFULLY"
        );

      } else {

        Serial.println(
          "Firebase: SOME DATA FAILED"
        );
      }

    } else {

      Serial.println(
        "Firebase: NOT READY"
      );
    }
  }


  // Small delay only.
  // Do NOT use delay(3000), because we want
  // pump commands to respond quickly.

  delay(250);
}