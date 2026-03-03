import { DataTypes, Model } from 'sequelize';

export default (sequelize: any, dataTypes: typeof DataTypes) => {
    class manuals extends Model { }
    manuals.init({
        id: { type: dataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        project_id: { type: dataTypes.INTEGER, allowNull: false },
        file_name: { type: dataTypes.STRING, allowNull: false },
        file_url: { type: dataTypes.TEXT, allowNull: false },
        file_size_mb: { type: dataTypes.FLOAT, defaultValue: 0 },
        type: { type: dataTypes.STRING(10), defaultValue: 'manual' },
        uploaded_by: { type: dataTypes.INTEGER },
    }, {
        sequelize,
        modelName: 'manuals',
        tableName: 'manuals',
    });
    return manuals;
};
