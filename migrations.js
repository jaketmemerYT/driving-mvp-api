// migrations.js

/**
 * Migration from the “pre-groupId” schema (v0.0.0)
 * into v1.0.0, which adds the `groupId` field to every run.
 */
function migrate_0_0_0_to_1_0_0(db) {
    console.log('Migrating schema 0.0.0 → 1.0.0: adding groupId to existing routes');
    db.routes = db.routes.map(run => ({
      ...run,
      groupId: run.groupId ?? null,
    }));
    return db;
  }
  
  module.exports = {
    migrate_0_0_0_to_1_0_0,
  };
  