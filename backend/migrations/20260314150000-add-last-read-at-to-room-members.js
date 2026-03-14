/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('room_members', 'last_read_at', {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('now')
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('room_members', 'last_read_at');
    }
};
