import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const File = sequelize.define(
        "files",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            folder_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            project_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            file_url: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            file_name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            file_type: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            file_size_mb: {
                type: DataTypes.INTEGER,
                allowNull: false,
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
            do_not_follow: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            only_for_reference: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            location: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            tags: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            assigned_to: {
                type: DataTypes.ARRAY(DataTypes.INTEGER),
                allowNull: true,
            },
            seen_at: {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: null,
            },
            seen_by: {
                type: DataTypes.ARRAY(DataTypes.INTEGER),
                allowNull: true,
                defaultValue: [],
            },
            parent_file_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            is_current: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
        },
        {
            tableName: "files",
            timestamps: true,
            paranoid: true,
        }
    );

    return File;
};
