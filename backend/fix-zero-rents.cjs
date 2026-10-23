// backend/fix-zero-rents.cjs
// Migration script to fix zero-rent leases and zero-amount payments in MongoDB

const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/propconnect_db";

async function run() {
  console.log("Connecting to MongoDB:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  const db = mongoose.connection.db;

  // 1. Fix Leases collection
  const leasesCol = db.collection("leases");
  const propertiesCol = db.collection("properties");
  const allLeases = await leasesCol.find({}).toArray();
  console.log(`Found ${allLeases.length} leases.`);

  let updatedLeases = 0;
  for (const lease of allLeases) {
    let rent = Number(lease.monthlyRent || lease.monthly_rent || lease.rent || 0);

    if (rent <= 0) {
      if (lease.id === "LSE001" || lease.id === "LSE001-R1" || lease.id === "LSE001-ORIG") {
        rent = 22000;
      } else if (lease.id === "LSE-P01") {
        rent = 10000;
      } else if (lease.id === "LSE-S02") {
        rent = 7000;
      } else if (lease.propertyId) {
        const prop = await propertiesCol.findOne({ id: lease.propertyId });
        if (prop && prop.rent) {
          rent = Number(prop.rent);
        }
      }

      if (rent <= 0) {
        const idLower = String(lease.id || "").toLowerCase();
        if (idLower.includes("-p") || idLower.includes("parking")) rent = 10000;
        else if (idLower.includes("-s") || idLower.includes("storage")) rent = 7000;
        else rent = 22000;
      }

      await leasesCol.updateOne(
        { _id: lease._id },
        {
          $set: {
            monthlyRent: rent,
            monthly_rent: rent,
            rent: rent,
            depositAmount: lease.depositAmount || rent * 3,
            deposit_amount: lease.depositAmount || rent * 3,
            deposit: lease.deposit || rent * 3,
          },
        }
      );
      updatedLeases++;
      console.log(`  ✓ Updated Lease ${lease.id} -> monthlyRent: ₹${rent}`);
    }
  }

  // 2. Fix Payments collection
  const paymentsCol = db.collection("payments");
  const zeroPayments = await paymentsCol.find({ amount: { $lte: 0 } }).toArray();
  console.log(`\nFound ${zeroPayments.length} payments with amount <= 0.`);

  for (const p of zeroPayments) {
    let amt = 22000;
    const desc = String((p.id || "") + " " + (p.leaseId || "") + " " + (p.propertyName || "")).toLowerCase();
    if (desc.includes("parking") || desc.includes("-p01") || desc.includes("-p")) {
      amt = 10000;
    } else if (desc.includes("storage") || desc.includes("-s02") || desc.includes("-s")) {
      amt = 7000;
    } else if (p.propertyId) {
      const prop = await propertiesCol.findOne({ id: p.propertyId });
      if (prop && prop.rent) amt = Number(prop.rent);
    }

    await paymentsCol.updateOne({ _id: p._id }, { $set: { amount: amt } });
    console.log(`  ✓ Updated Payment ${p.id} (${p.propertyName}) -> amount: ₹${amt}`);
  }

  console.log(`\nDone! Repaired ${updatedLeases} leases and ${zeroPayments.length} payments.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
