'use strict';
module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('snags', {
            id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
            project_id: {
                type: Sequelize.INTEGER, allowNull: false,
                references: { model: 'projects', key: 'id' }, onDelete: 'CASCADE',
            },
            title: { type: Sequelize.STRING(200), allowNull: false },
            description: { type: Sequelize.TEXT },
            photo_url: { type: Sequelize.TEXT },
            assigned_to: { type: Sequelize.INTEGER, references: { model: 'users', key: 'id' } },
            status: { type: Sequelize.STRING(10), defaultValue: 'amber' }, // amber | green | red
            last_comment: { type: Sequelize.TEXT },
            created_by: { type: Sequelize.INTEGER, references: { model: 'users', key: 'id' } },
            createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });
        await queryInterface.addIndex('snags', ['project_id']);
    },
    down: async (queryInterface) => {
        await queryInterface.dropTable('snags');
    },
};
