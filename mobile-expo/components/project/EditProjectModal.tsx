import React, { useState, useEffect } from 'react';
import {
    View, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Text, TextInput } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { updateProject } from '@/services/projectService';
import { Project } from '@/types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    onUpdate: (updated: Project) => void;
    initialFocus?: 'start_date' | 'end_date' | null;
}

export default function EditProjectModal({ isOpen, onClose, project, onUpdate, initialFocus }: Props) {
    const { colors, isDark } = useTheme();
    const [name, setName] = useState(project.name);
    const [description, setDescription] = useState(project.description || '');
    const [startDate, setStartDate] = useState(
        (project.start_date || project.startDate || '').split('T')[0]
    );
    const [endDate, setEndDate] = useState(
        (project.end_date || project.endDate || '').split('T')[0]
    );
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [loading, setLoading] = useState(false);


    useEffect(() => {
        setName(project.name);
        setDescription(project.description || '');
        setStartDate((project.start_date || project.startDate || '').split('T')[0]);
        setEndDate((project.end_date || project.endDate || '').split('T')[0]);
    }, [project]);

    useEffect(() => {
        if (isOpen && initialFocus) {
            if (initialFocus === 'start_date') {
                setShowStartPicker(true);
            } else if (initialFocus === 'end_date') {
                setShowEndPicker(true);
            }
        }
    }, [isOpen, initialFocus]);

    const onStartDateChange = (event: any, selectedDate?: Date) => {
        setShowStartPicker(false);
        if (selectedDate) {
            setStartDate(selectedDate.toISOString().split('T')[0]);
        }
    };

    const onEndDateChange = (event: any, selectedDate?: Date) => {
        setShowEndPicker(false);
        if (selectedDate) {
            setEndDate(selectedDate.toISOString().split('T')[0]);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setLoading(true);
        try {
            const res = await updateProject(project.id, {
                name,
                description,
                start_date: startDate,
                end_date: endDate
            });
            onUpdate(res.project);
            onClose();
        } catch (error) {
            console.error("Update error:", error);
        } finally {
            setLoading(false);
        }
    };


    return (
        <Modal
            visible={isOpen}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View style={[styles.modalView, { backgroundColor: colors.surface }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.text }]}>Edit Project</Text>
                        <TouchableOpacity onPress={onClose} disabled={loading}>
                            <Feather name="x" size={20} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ width: '100%' }}
                    >
                        <ScrollView style={styles.content}>
                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: colors.textMuted }]}>Project Name</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="Enter project name"
                                    placeholderTextColor="#888"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: colors.textMuted }]}>Description</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    value={description}
                                    onChangeText={setDescription}
                                    placeholder="Enter description"
                                    placeholderTextColor="#888"
                                    multiline
                                    numberOfLines={4}
                                />
                            </View>

                            <View style={styles.row}>
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={[styles.label, { color: colors.textMuted }]}>Start Date</Text>
                                    <TouchableOpacity 
                                        activeOpacity={0.7}
                                        onPress={() => setShowStartPicker(true)}
                                    >
                                        <View pointerEvents="none">
                                            <TextInput
                                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                                value={startDate}
                                                editable={false}
                                                placeholder="YYYY-MM-DD"
                                                placeholderTextColor="#888"
                                            />
                                        </View>
                                    </TouchableOpacity>
                                    {showStartPicker && (
                                        <DateTimePicker
                                            value={startDate ? new Date(startDate) : new Date()}
                                            mode="date"
                                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                            onChange={onStartDateChange}
                                        />
                                    )}
                                </View>
                                <View style={{ width: 12 }} />
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={[styles.label, { color: colors.textMuted }]}>End Date</Text>
                                    <TouchableOpacity 
                                        activeOpacity={0.7}
                                        onPress={() => setShowEndPicker(true)}
                                    >
                                        <View pointerEvents="none">
                                            <TextInput
                                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                                value={endDate}
                                                editable={false}
                                                placeholder="YYYY-MM-DD"
                                                placeholderTextColor="#888"
                                            />
                                        </View>
                                    </TouchableOpacity>
                                    {showEndPicker && (
                                        <DateTimePicker
                                            value={endDate ? new Date(endDate) : new Date()}
                                            mode="date"
                                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                            onChange={onEndDateChange}
                                        />
                                    )}
                                </View>
                            </View>


                            <View style={styles.footer}>
                                <TouchableOpacity
                                    style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
                                    onPress={onClose}
                                    disabled={loading}
                                >
                                    <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
                                    onPress={handleSave}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={[styles.buttonText, { color: '#fff' }]}>Save</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        minHeight: '60%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
    },
    content: {
        width: '100%',
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        borderWidth: 1,
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    row: {
        flexDirection: 'row',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 20,
        paddingBottom: 40,
    },
    button: {
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 20,
        minWidth: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        borderWidth: 1,
    },
    saveButton: {
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
