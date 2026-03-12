'use strict';
export default {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('rooms', {
            id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            name: {
                type: Sequelize.STRING,
                allowNull: true
            },
            type: {
                type: Sequelize.ENUM('direct', 'group'),
                defaultValue: 'direct',
                allowNull: false
            },
            project_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'projects', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            },
            organization_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'organizations', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            },
            createdAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            updatedAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
        });
    },
    down: async (queryInterface) => {
        await queryInterface.dropTable('rooms');
    },
};
