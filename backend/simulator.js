const firebaseAdmin = await import("firebase-admin");

const admin = firebaseAdmin.default || firebaseAdmin;

admin.initializeApp({
  credential: admin.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();
  console.log("");
  console.log("================================================");
  console.log("     AGRIGUARD NEXUS LIVE SIMULATOR");
  console.log("================================================");
  console.log("");

  console.log(
    "Firebase database: " +
    (process.env.FIREBASE_DATABASE_URL
      ? "CONFIGURED"
      : "NOT CONFIGURED")
  );

  console.log(
    "Update interval: " +
    UPDATE_INTERVAL / 1000 +
    " seconds"
  );

  console.log("");

  // ======================================================
  // FARM ZONES
  // ======================================================

  const zones = {

    zoneA: {
      id: "zoneA",
      name: "Zone A",
      crop: "Macadamia",
      soilMoisture: 48,
      soilTemperature: 23,
      irrigation: {
        valveOpen: false,
        flowRate: 0
      },
      moistureStatus: "NORMAL"
    },

    zoneB: {
      id: "zoneB",
      name: "Zone B",
      crop: "Citrus",
      soilMoisture: 52,
      soilTemperature: 24,
      irrigation: {
        valveOpen: false,
        flowRate: 0
      },
      moistureStatus: "NORMAL"
    },

    zoneC: {
      id: "zoneC",
      name: "Zone C",
      crop: "Macadamia",
      soilMoisture: 44,
      soilTemperature: 22,
      irrigation: {
        valveOpen: false,
        flowRate: 0
      },
      moistureStatus: "NORMAL"
    }

  };


  // ======================================================
  // FARM STATE
  // ======================================================

  let reservoirLevel = 78;

  let ambientTemperature = 25;

  let humidity = 61;

  let lightIntensity = 650;

  let batteryPercentage = 86;

  let solarProductionKW = 4.2;

  let esp32Connected = true;

  let esp32Signal = -48;

  let pumpRunning = false;


  // ======================================================
  // HELPER FUNCTIONS
  // ======================================================

  function random(min, max) {

    return Math.random() * (max - min) + min;

  }


  function clamp(value, min, max) {

    return Math.min(
      Math.max(value, min),
      max
    );

  }


  function round(value, decimals = 1) {

    return Number(
      value.toFixed(decimals)
    );

  }


  function drift(
    value,
    amount,
    min,
    max
  ) {

    value += random(
      -amount,
      amount
    );

    return clamp(
      value,
      min,
      max
    );

  }


  // ======================================================
  // ENVIRONMENT SIMULATION
  // ======================================================

  function updateEnvironment() {

    ambientTemperature = drift(
      ambientTemperature,
      0.7,
      15,
      38
    );

    humidity = drift(
      humidity,
      2,
      35,
      95
    );

    lightIntensity = drift(
      lightIntensity,
      80,
      100,
      1200
    );

    solarProductionKW =
      lightIntensity / 250 +
      random(-0.2, 0.2);

    solarProductionKW =
      clamp(
        solarProductionKW,
        0,
        6
      );

    ambientTemperature =
      round(
        ambientTemperature,
        1
      );

    humidity =
      round(
        humidity,
        1
      );

    lightIntensity =
      Math.round(
        lightIntensity
      );

    solarProductionKW =
      round(
        solarProductionKW,
        2
      );

  }


  // ======================================================
  // ZONE SIMULATION
  // ======================================================

  function updateZone(zone) {

    // Soil temperature changes slowly
    zone.soilTemperature =
      drift(
        zone.soilTemperature,
        0.5,
        15,
        35
      );


    // Natural moisture loss
    zone.soilMoisture -=
      random(
        0.5,
        1.5
      );


    // ----------------------------------------------------
    // AUTOMATIC IRRIGATION DECISION
    // ----------------------------------------------------

    if (
      zone.soilMoisture < 35 &&
      reservoirLevel > 15
    ) {

      zone.irrigation.valveOpen =
        true;

      zone.moistureStatus =
        "LOW";

    }


    else if (
      zone.soilMoisture > 60
    ) {

      zone.irrigation.valveOpen =
        false;

      zone.moistureStatus =
        "NORMAL";

    }


    else if (
      zone.soilMoisture >= 35
    ) {

      zone.moistureStatus =
        "NORMAL";

    }


    // ----------------------------------------------------
    // IRRIGATION EFFECT
    // ----------------------------------------------------

    if (
      zone.irrigation.valveOpen &&
      reservoirLevel > 15
    ) {

      zone.soilMoisture +=
        random(
          2,
          5
        );

      zone.irrigation.flowRate =
        round(
          random(
            12,
            24
          ),
          1
        );

    }

    else {

      zone.irrigation.flowRate =
        0;

    }


    // Keep moisture realistic
    zone.soilMoisture =
      clamp(
        zone.soilMoisture,
        10,
        90
      );


    // Round values
    zone.soilMoisture =
      round(
        zone.soilMoisture,
        1
      );

    zone.soilTemperature =
      round(
        zone.soilTemperature,
        1
      );

  }


  // ======================================================
  // RESERVOIR
  // ======================================================

  function updateReservoir() {

    let totalFlow = 0;


    for (
      const zone of Object.values(zones)
    ) {

      if (
        zone.irrigation.valveOpen
      ) {

        totalFlow +=
          zone.irrigation.flowRate;

      }

    }


    // Water consumption
    if (
      totalFlow > 0
    ) {

      reservoirLevel -=
        totalFlow * 0.003;

    }


    // Small natural recovery
    else {

      reservoirLevel +=
        random(
          0,
          0.08
        );

    }


    reservoirLevel =
      clamp(
        reservoirLevel,
        5,
        100
      );


    reservoirLevel =
      round(
        reservoirLevel,
        1
      );


    return round(
      totalFlow,
      1
    );

  }


  // ======================================================
  // ENERGY SYSTEM
  // ======================================================

  function updateEnergy() {

    // Solar production changes
    solarProductionKW =
      clamp(
        solarProductionKW +
        random(
          -0.3,
          0.3
        ),
        0,
        6
      );


    // Pump consumes energy
    if (
      pumpRunning
    ) {

      batteryPercentage -=
        random(
          0.1,
          0.4
        );

    }


    // Solar charges battery
    else if (
      solarProductionKW > 2
    ) {

      batteryPercentage +=
        random(
          0.05,
          0.2
        );

    }


    batteryPercentage =
      clamp(
        batteryPercentage,
        10,
        100
      );


    solarProductionKW =
      round(
        solarProductionKW,
        2
      );


    batteryPercentage =
      round(
        batteryPercentage,
        1
      );

  }


  // ======================================================
  // ESP32 SIMULATION
  // ======================================================

  function updateDevice() {

    const connectionEvent =
      Math.random();


    // Small chance of disconnect
    if (
      connectionEvent < 0.02
    ) {

      esp32Connected =
        false;

    }


    // Small chance of reconnect
    else if (
      connectionEvent > 0.98
    ) {

      esp32Connected =
        true;

    }


    if (
      esp32Connected
    ) {

      esp32Signal =
        Math.round(
          random(
            -55,
            -40
          )
        );

    }

    else {

      esp32Signal =
        0;

    }

  }


  // ======================================================
  // FIREBASE DATA
  // ======================================================

  function createFirebaseData(
    totalFlow
  ) {

    const timestamp =
      new Date().toISOString();


    return {

      farm: {

        id:
          FARM_ID,

        name:
          "AgriGuard Nexus Farm",

        status:
          esp32Connected
            ? "ONLINE"
            : "OFFLINE",

        lastUpdate:
          timestamp

      },


      environment: {

        temperature:
          ambientTemperature,

        humidity:
          humidity,

        lightIntensity:
          lightIntensity

      },


      zones: {

        zoneA:
          zones.zoneA,

        zoneB:
          zones.zoneB,

        zoneC:
          zones.zoneC

      },


      reservoir: {

        level:
          reservoirLevel,

        capacityLitres:
          10000,

        waterAvailable:
          reservoirLevel > 15,

        status:
          reservoirLevel < 20
            ? "LOW"
            : "NORMAL"

      },


      energy: {

        solarProductionKW:
          solarProductionKW,

        batteryPercentage:
          batteryPercentage,

        status:
          batteryPercentage < 20
            ? "LOW"
            : "NORMAL"

      },


      irrigation: {

        pumpRunning:
          pumpRunning,

        flowRate:
          totalFlow,

        status:
          pumpRunning
            ? "ACTIVE"
            : "IDLE"

      },


      devices: {

        esp32: {

          connected:
            esp32Connected,

          signal:
            esp32Signal,

          lastSeen:
            timestamp

        }

      },


      simulation: {

        active:
          true,

        updateIntervalSeconds:
          UPDATE_INTERVAL / 1000,

        timestamp:
          timestamp

      }

    };

  }


  // ======================================================
  // MAIN SIMULATION
  // ======================================================

  async function simulateFarm() {

    try {

      // Environment
      updateEnvironment();


      // Zones
      updateZone(
        zones.zoneA
      );

      updateZone(
        zones.zoneB
      );

      updateZone(
        zones.zoneC
      );


      // Reservoir
      const totalFlow =
        updateReservoir();


      // Pump
      pumpRunning =
        totalFlow > 0;


      // Energy
      updateEnergy();


      // ESP32
      updateDevice();


      // Create Firebase data
      const firebaseData =
        createFirebaseData(
          totalFlow
        );


      // --------------------------------------------------
      // SEND TO FIREBASE
      // --------------------------------------------------

      await db
        .ref(ROOT)
        .update(
          firebaseData
        );


      // --------------------------------------------------
      // TERMINAL DISPLAY
      // --------------------------------------------------

      console.clear();


      console.log(
        "================================================"
      );

      console.log(
        "       AGRIGUARD NEXUS - LIVE SIMULATOR"
      );

      console.log(
        "================================================"
      );

      console.log("");


      console.log(
        "Firebase: CONNECTED"
      );

      console.log(
        "Updated: " +
        new Date().toLocaleString()
      );

      console.log("");


      // --------------------------------------------------
      // ENVIRONMENT
      // --------------------------------------------------

      console.log(
        "ENVIRONMENT"
      );

      console.log(
        "Temperature : " +
        ambientTemperature +
        " °C"
      );

      console.log(
        "Humidity    : " +
        humidity +
        " %"
      );

      console.log(
        "Light       : " +
        lightIntensity +
        " lux"
      );

      console.log("");


      // --------------------------------------------------
      // ZONES
      // --------------------------------------------------

      console.log(
        "ZONES"
      );


      for (
        const zone of Object.values(zones)
      ) {

        console.log("");


        console.log(
          zone.name +
          " - " +
          zone.crop
        );


        console.log(
          "Soil moisture    : " +
          zone.soilMoisture +
          "%"
        );


        console.log(
          "Soil temperature : " +
          zone.soilTemperature +
          " °C"
        );


        console.log(
          "Status           : " +
          zone.moistureStatus
        );


        console.log(
          "Valve            : " +
          (
            zone.irrigation.valveOpen
              ? "OPEN"
              : "CLOSED"
          )
        );


        console.log(
          "Flow             : " +
          zone.irrigation.flowRate +
          " L/min"
        );

      }


      console.log("");


      // --------------------------------------------------
      // RESERVOIR
      // --------------------------------------------------

      console.log(
        "RESERVOIR"
      );


      console.log(
        "Level: " +
        reservoirLevel +
        "%"
      );


      console.log(
        "Water available: " +
        (
          reservoirLevel > 15
            ? "YES"
            : "NO"
        )
      );


      console.log("");


      // --------------------------------------------------
      // ENERGY
      // --------------------------------------------------

      console.log(
        "ENERGY"
      );


      console.log(
        "Solar: " +
        solarProductionKW +
        " kW"
      );


      console.log(
        "Battery: " +
        batteryPercentage +
        "%"
      );


      console.log("");


      // --------------------------------------------------
      // IRRIGATION
      // --------------------------------------------------

      console.log(
        "IRRIGATION"
      );


      console.log(
        "Pump: " +
        (
          pumpRunning
            ? "RUNNING"
            : "IDLE"
        )
      );


      console.log(
        "Total flow: " +
        totalFlow +
        " L/min"
      );


      console.log("");


      // --------------------------------------------------
      // ESP32
      // --------------------------------------------------

      console.log(
        "ESP32 DEVICE"
      );


      console.log(
        "Connection: " +
        (
          esp32Connected
            ? "CONNECTED"
            : "DISCONNECTED"
        )
      );


      console.log(
        "Signal: " +
        esp32Signal +
        " dBm"
      );


      console.log("");


      // --------------------------------------------------
      // FIREBASE PATH
      // --------------------------------------------------

      console.log(
        "Firebase path: " +
        ROOT
      );


      console.log("");


      console.log(
        "Next update in " +
        UPDATE_INTERVAL / 1000 +
        " seconds..."
      );


    }

    catch (error) {

      console.log("");


      console.error(
        "================================================"
      );


      console.error(
        "SIMULATOR ERROR"
      );


      console.error(
        "================================================"
      );


      console.error(
        error
      );


      console.log("");

    }

  }


  // ======================================================
  // START
  // ======================================================

  await simulateFarm();


  // Continue every 5 seconds
  setInterval(
    simulateFarm,
    UPDATE_INTERVAL
  );

}


// ========================================================
// RUN
// ========================================================

startSimulator()
  .catch(
    (error) => {

      console.error("");
      console.error(
        "FAILED TO START AGRIGUARD SIMULATOR"
      );
      console.error("");
      console.error(
        error
      );
      console.error("");

    }
  );