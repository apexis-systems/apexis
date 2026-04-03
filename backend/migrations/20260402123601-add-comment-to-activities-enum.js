'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
    up: async (queryInterface, Sequelize) => {
        try {
            // Adding 'comment' and 'uploaded' (which was in model but not original migration)
            await queryInterface.sequelize.query('ALTER TYPE "enum_activities_type" ADD VALUE IF NOT EXISTS \'uploaded\'');
            await queryInterface.sequelize.query('ALTER TYPE "enum_activities_type" ADD VALUE IF NOT EXISTS \'comment\'');
        } catch (error) {
            console.warn('Wait, maybe not Postgres or ENUM name differs. Trying changeColumn.');
            // Fallback: try to change the column definition
            await queryInterface.changeColumn('activities', 'type', {
                type: Sequelize.ENUM("upload", "edit", "delete", "share", "upload_photo", "uploaded", "comment"),
                allowNull: false,
                defaultValue: "upload"
            });
        }
    },

    down: async (queryInterface, Sequelize) => {
        // Removing values from ENUM is not directly supported in Postgres without recreating the type.
        // Reverting the column definition to a smaller set if needed.
        try {
            await queryInterface.changeColumn('activities', 'type', {
                type: Sequelize.ENUM("upload", "edit", "delete", "share", "upload_photo"),
                allowNull: false,
                defaultValue: "upload"
            });
        } catch (err) {
            console.error('Down migration failed (common for ENUM changes):', err.message);
        }
    }
};
