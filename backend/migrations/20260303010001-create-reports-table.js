'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('reports', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            project_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'projects', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            type: {
                type: Sequelize.ENUM('daily', 'weekly', 'monthly'),
                allowNull: false,
            },
            period_start: {
                type: Sequelize.DATEONLY,
                allowNull: false,
            },
            period_end: {
                type: Sequelize.DATEONLY,
                allowNull: false,
            },
            photos_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            docs_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            releases_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            comments_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            summary: {
                type: Sequelize.JSONB,
                allowNull: true,
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW'),
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW'),
            },
        });

        // Unique constraint: one report per project per type per day/week
        await queryInterface.addIndex('reports', ['project_id', 'type', 'period_start', 'period_end'], {
            unique: true,
            name: 'reports_project_type_period_unique',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('reports');
    },
};
