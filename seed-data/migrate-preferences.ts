import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/bulkmandi";

async function runMigration() {
  console.log("Connecting to MongoDB:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection failed");

  console.log("Starting Migration of Operational Preferences...");
  
  const orgsCollection = db.collection('organizations');
  const buyerCollection = db.collection('buyerpreferences');
  const sellerCollection = db.collection('sellerpreferences');
  const logisticCollection = db.collection('logisticpreferences');

  const cursor = orgsCollection.find({
    $or: [
      { buyerPreferences: { $exists: true, $ne: null } },
      { catalog: { $exists: true, $ne: null } },
      { fleetAndCompliance: { $exists: true, $ne: null } }
    ]
  });

  let migratedCount = 0;

  for await (const org of cursor) {
    console.log(`Migrating Org: ${org.legalName} (${org._id})`);

    // 1. Buyer Preferences
    if (org.buyerPreferences) {
      await buyerCollection.updateOne(
        { organizationId: org._id },
        { 
          $set: { 
            organizationId: org._id,
            ...org.buyerPreferences,
            createdAt: new Date(),
            updatedAt: new Date()
          } 
        },
        { upsert: true }
      );
    }

    // 2. Seller Catalog
    if (org.catalog) {
      await sellerCollection.updateOne(
        { organizationId: org._id },
        { 
          $set: { 
            organizationId: org._id,
            catalogProducts: org.catalog.catalogProducts || [],
            plantLocations: org.catalog.plantLocations || [],
            logisticsPreference: org.catalog.logisticsPreference || {},
            createdAt: new Date(),
            updatedAt: new Date()
          } 
        },
        { upsert: true }
      );
    }

    // 3. Fleet and Compliance
    if (org.fleetAndCompliance) {
      await logisticCollection.updateOne(
        { organizationId: org._id },
        { 
          $set: { 
            organizationId: org._id,
            ...org.fleetAndCompliance,
            createdAt: new Date(),
            updatedAt: new Date()
          } 
        },
        { upsert: true }
      );
    }

    // 4. Strip from Organization (The KYC Document)
    await orgsCollection.updateOne(
      { _id: org._id },
      { 
        $unset: { 
          buyerPreferences: "", 
          catalog: "", 
          fleetAndCompliance: "" 
        } 
      }
    );

    migratedCount++;
  }

  console.log(`Migration Complete. Successfully extracted operational data from ${migratedCount} organizations.`);
  await mongoose.disconnect();
}

runMigration().catch(err => {
  console.error("Migration Failed:", err);
  process.exit(1);
});
