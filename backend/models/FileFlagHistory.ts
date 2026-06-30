import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const FileFlagHistory = sequelize.define(
        "file_flag_history",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            file_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            flag: {
                type: DataTypes.ENUM('do_not_follow', 'only_for_reference'),
                allowNull: false,
            },
            value: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
            },
            changed_by: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
        },
        {
            tableName: "file_flag_history",
            // History rows are immutable — only createdAt matters
            timestamps: true,
            updatedAt: false,
            paranoid: false,
        }
    );

    return FileFlagHistory;
};
