// migrations.js
const { nanoid } = require('nanoid');

function migrate_0_0_0_to_1_0_0(db) {
  console.log('Migrating schema 0.0.0 → 1.0.0: backfill groupId on runs');
  db.routes = db.routes.map(r => ({ ...r, groupId: r.groupId ?? null }));
  return db;
}

function migrate_1_0_0_to_1_1_0(db) {
  console.log('Migrating schema 1.0.0 → 1.1.0: add users & groupMembers');
  db.users        = db.users        || [];
  db.groupMembers = db.groupMembers || [];
  return db;
}

function migrate_1_1_0_to_1_2_0(db) {
  console.log('Migrating schema 1.1.0 → 1.2.0: add categories & trailCategories');
  const defaultCats = [
    { id: nanoid(), name: 'Scenic'      },
    { id: nanoid(), name: 'Challenging' },
    { id: nanoid(), name: 'Off-Road'    },
  ];
  db.categories      = Array.isArray(db.categories) && db.categories.length
                       ? db.categories
                       : defaultCats;
  db.trailCategories = db.trailCategories || [];
  return db;
}

module.exports = {
  migrate_0_0_0_to_1_0_0,
  migrate_1_0_0_to_1_1_0,
  migrate_1_1_0_to_1_2_0,
};
