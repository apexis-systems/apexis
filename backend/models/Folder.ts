import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const Folder = sequelize.define(
        "folders",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            project_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            parent_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            created_by: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            client_visible: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            folder_type: {
                type: DataTypes.STRING,
                allowNull: true,
            },
        },
        {
            tableName: "folders",
            timestamps: true,
        }
    );

    return Folder;
};
