#!/usr/bin/env node

/**
 * Image Migration CLI Tool
 * 
 * Usage:
 *   node scripts/runImageMigration.js [options]
 * 
 * Options:
 *   --spreads    Migrate only spread images
 *   --decks      Migrate only deck images
 *   --all        Migrate all images (default)
 *   --dry-run    Show what would be migrated without making changes
 */

const { migrateSpreadImages, migrateDeckImages, migrateAllImages } = require('./migrateImages');

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  
  console.log('🚀 Image Migration Tool');
  console.log('========================');
  
  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made');
  }
  
  try {
    if (args.includes('--spreads')) {
      console.log('📄 Migrating spread images only...');
      await migrateSpreadImages();
    } else if (args.includes('--decks')) {
      console.log('🃏 Migrating deck images only...');
      await migrateDeckImages();
    } else {
      console.log('🌐 Migrating all images...');
      await migrateAllImages();
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Test image serving endpoints: /api/images/spreads and /api/images/decks');
    console.log('2. Update frontend to use backend image URLs');
    console.log('3. Verify CORS issues are resolved');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };