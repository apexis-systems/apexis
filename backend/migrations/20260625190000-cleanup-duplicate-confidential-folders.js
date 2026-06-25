'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    // 1. Find all duplicates
    const [duplicates] = await queryInterface.sequelize.query(`
      SELECT project_id, COALESCE(folder_type, '') as folder_type, COUNT(*) as cnt
      FROM folders
      WHERE name ILIKE 'Confidential'
      GROUP BY project_id, COALESCE(folder_type, '')
      HAVING COUNT(*) > 1
    `);

    for (const dup of duplicates) {
      const { project_id, folder_type } = dup;
      // 2. Fetch all folders matching this project and type, sorted by id
      const [foldersList] = await queryInterface.sequelize.query(`
        SELECT id FROM folders
        WHERE project_id = ?
          AND name ILIKE 'Confidential'
          AND (folder_type = ? OR (folder_type IS NULL AND ? = ''))
        ORDER BY id ASC
      `, {
        replacements: [project_id, folder_type, folder_type]
      });

      if (foldersList.length > 1) {
        const keepId = foldersList[0].id;
        const duplicateIds = foldersList.slice(1).map(f => f.id);

        // 3. Move files to the kept folder
        await queryInterface.sequelize.query(`
          UPDATE files
          SET folder_id = ?
          WHERE folder_id IN (?)
        `, {
          replacements: [keepId, duplicateIds]
        });

        // 4. Delete duplicate folders
        await queryInterface.sequelize.query(`
          DELETE FROM folders
          WHERE id IN (?)
        `, {
          replacements: [duplicateIds]
        });
        
        console.log(`Cleaned up duplicate Confidential folders for project ${project_id} (${folder_type}): kept folder ${keepId}, deleted ${duplicateIds.join(', ')}`);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    // No-op
  }
};
