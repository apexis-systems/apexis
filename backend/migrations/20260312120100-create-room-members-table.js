'use strict';
export default {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('room_members', {
            id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            room_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'rooms', key: 'id' },
                onDelete: 'CASCADE'
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE'
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
        await queryInterface.addIndex('room_members', ['room_id', 'user_id'], { unique: true });
    },
    down: async (queryInterface) => {
        await queryInterface.dropTable('room_members');
    },
};
