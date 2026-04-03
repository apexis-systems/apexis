'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('users', 'phone_number', {
            type: Sequelize.STRING,
            allowNull: true,
            unique: true,
        });
        await queryInterface.addColumn('users', 'phone_verified', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('users', 'phone_number');
        await queryInterface.removeColumn('users', 'phone_verified');
    }
};
