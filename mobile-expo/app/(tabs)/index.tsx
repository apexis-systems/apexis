import { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, Modal, ActivityIndicator, Platform, Image, KeyboardAvoidingView } from 'react-native';
import { Text, TextInput } from '@/components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@/contexts/AuthContext';
import { PrivateAxios } from '@/helpers/PrivateAxios';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/contexts/ThemeContext';
import { useSocket } from '@/contexts/SocketContext';
import HelpSupportModal from '@/components/shared/HelpSupportModal';
import FeedbackModal from '@/components/shared/FeedbackModal';
import LanguageSelectorModal from '@/components/shared/LanguageSelectorModal';
import { useTranslation } from 'react-i18next';
import { setActiveProjectContext } from '@/utils/projectSelection';
import * as ImagePicker from 'expo-image-picker';
import { uploadOrganizationLogo, fetchSecureLogo, getOrganizations } from '@/services/organizationService';
import LogoPreviewModal from '@/components/shared/LogoPreviewModal';
import MainHeader from '@/components/shared/MainHeader';
import SecureAvatar from '@/components/shared/SecureAvatar';
import { getSecureFileUrl } from '@/services/fileService';
import { registerForPushNotificationsAsync } from '@/services/notificationService';
import { handleNotificationNavigation } from '@/utils/navigation';

export default function DashboardScreen() {
  const { user, updateUser } = useAuth();
  const { isDark, toggleTheme, colors } = useTheme();
  const { unreadNotificationCount } = useSocket();
  const { t } = useTranslation();
  const router = useRouter();


  const [projects, setProjects] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', start_date: '', end_date: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  const [localLogoKey, setLocalLogoKey] = useState<string | null>(null);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isProfilePreviewOpen, setIsProfilePreviewOpen] = useState(false);
  const [profileUri, setProfileUri] = useState<string | null>(null);


  useEffect(() => {
    if (user) {
      if (user.role === 'superadmin') {
        fetchOrganizations();
      }
      fetchProjects(selectedOrgId);
      // Handle setting initial logo
      const orgs = (user as any).organizations || (user as any).organization;
      if (orgs?.logo) {
        setLocalLogoKey(orgs.logo);
      }
      
      // Request notification permissions and register token on home screen
      registerForPushNotificationsAsync();

      // Listen for notification interactions
      const responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
        const { type } = response.notification.request.content.data;
        const data = response.notification.request.content.data;
        handleNotificationNavigation(type, data, router);
      });

      return () => {
        responseListener.remove();
      };
    }
  }, [user, selectedOrgId]);

  useEffect(() => {
    const fetchLogo = async () => {
      if (localLogoKey) {
        const uri = await fetchSecureLogo(localLogoKey);
        if (uri) {
          setLogoUri(uri);
        }
      }
    };
    fetchLogo();
  }, [localLogoKey]);

  useFocusEffect(
    useCallback(() => {
      // Clear out the active project scope if they return to Dashboard
      setActiveProjectContext(null, null);
    }, [])
  );

  useEffect(() => {
    const fetchProfileUri = async () => {
      if (user?.profile_pic) {
        const uri = await getSecureFileUrl(user.profile_pic);
        setProfileUri(uri);
      }
    };
    fetchProfileUri();
  }, [user?.profile_pic]);

  if (!user) return null;

  const fetchOrganizations = async () => {
    try {
      const orgs = await getOrganizations();
      setOrganizations(orgs || []);
    } catch (err) {
      console.error("Failed to fetch organizations:", err);
    }
  };

  const fetchProjects = async (orgId?: string | null) => {
    try {
      const url = orgId ? `/projects?organization_id=${orgId}` : '/projects';
      const res = await PrivateAxios.get(url);
      setProjects(res.data.projects || []);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalDocs = filteredProjects.reduce((sum, p) => sum + (parseInt(p.totalDocs, 10) || 0), 0);
  const totalPhotos = filteredProjects.reduce((sum, p) => sum + (parseInt(p.totalPhotos, 10) || 0), 0);
  const totalFolders = filteredProjects.reduce((sum, p) => sum + (parseInt(p.totalFolders, 10) || 0), 0);

  const handleCreate = async () => {
    if (!newProject.name || !newProject.start_date || !newProject.end_date) return;
    setIsSubmitting(true);
    try {
      await PrivateAxios.post('/projects', newProject);
      setIsCreating(false);
      setNewProject({ name: '', description: '', start_date: '', end_date: '' });
      fetchProjects();
    } catch (e) {
      console.error("Failed to create project:", e);
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleLogoUpload = async () => {
    if (user?.role !== 'admin') return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      setIsUploadingLogo(true);
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('logo', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || 'logo.jpg',
      } as any);

      const res = await uploadOrganizationLogo(formData);
      setLocalLogoKey(res.logo);

      // Update AuthContext so it reflects globally immediately
      if (user) {
        const updatedOrg = { ...(user as any).organization, logo: res.logo };
        updateUser({ organization: updatedOrg } as any);
      }
    } catch (e: any) {
      console.error("Logo upload error:", e);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const roleSubtitle =
    user.role === 'superadmin'
      ? 'Super Admin'
      : user.role === 'admin'
        ? t('dashboard.roles.admin')
        : user.role === 'contributor'
          ? t('dashboard.roles.contributor')
          : t('dashboard.roles.client');


  return (
    <>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
        <MainHeader
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search projects by name..."
        />



        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
          {/* Centered Company Logo + User Name */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => setIsPreviewOpen(true)}
              style={{
                width: 80,
                height: 80,
                borderRadius: 20,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                marginBottom: 12,
              }}
            >
              {isUploadingLogo ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (logoUri || user.role === 'superadmin') ? (
                <Image
                  source={logoUri ? { uri: logoUri } : require('../../assets/images/app-icon.png')}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Feather name="camera" size={20} color={colors.textMuted} />
                  <Text style={{ fontSize: 8, color: colors.textMuted }}>Add Logo</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 4 }}>
                {`${((user as any).organization?.name || 'APEXIS').charAt(0).toUpperCase() + ((user as any).organization?.name || 'APEXIS').slice(1)}`}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity onPress={() => setIsProfilePreviewOpen(true)}>
                  <SecureAvatar
                    fileKey={user.profile_pic}
                    name={user.name}
                    size={36}
                    style={{ borderWidth: 1.5 }}
                  />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>
                  {`Hi ${user.name.split(' ')[0].charAt(0).toUpperCase() + user.name.split(' ')[0].slice(1)}`}
                </Text>
              </View>

              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                {`${roleSubtitle} • ${user.email || user.phone_number}`}
              </Text>
            </View>
          </View>

          {/* Stats Row */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            {[
              { label: 'Projects', value: filteredProjects.length },
              { label: 'Folders', value: totalFolders },
              { label: 'Documents', value: totalDocs },
              { label: 'Photos', value: totalPhotos },
            ].map((stat) => (
              <View
                key={stat.label}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{stat.value}</Text>
                <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 2, textAlign: 'center' }}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Admin Analytics shortcut — admin / superadmin only */}
          {(user.role === 'admin' || user.role === 'superadmin') && (
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/analytics')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: 'rgba(249,116,22,0.08)',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(249,116,22,0.25)',
                padding: 14,
                marginBottom: 18,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(249,116,22,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="bar-chart-2" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Admin Analytics</Text>
                <Text style={{ fontSize: 10, color: colors.textMuted }}>Company-wide project intelligence</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}

          {/* Section label with Org Filter for Superadmin */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '500', color: colors.textMuted }}>
              {t('dashboard.yourProjects')}
            </Text>
            {user.role === 'superadmin' && organizations.length > 0 && (
              <TouchableOpacity
                onPress={() => setIsOrgDropdownOpen(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: colors.surface,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>
                  {selectedOrgId ? organizations.find(o => o.id === selectedOrgId)?.name : 'All Organizations'}
                </Text>
                <Feather name="chevron-down" size={12} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Project Grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {filteredProjects.map((project) => (
              <TouchableOpacity
                key={project.id}
                onPress={() => router.push(`/project/${project.id}`)}
                style={{ width: '22%', alignItems: 'center', gap: 6 }}
              >
                {/* Thumbnail */}
                <View
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 16,
                    backgroundColor: project.color || colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                  }}
                >
                  <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff' }}>
                    {project.name ? project.name.charAt(0).toUpperCase() : '?'}
                  </Text>
                </View>
                {/* Name */}
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 10,
                    fontWeight: '600',
                    color: colors.text,
                    textAlign: 'center',
                    lineHeight: 13,
                  }}
                >
                  {project.name}
                </Text>
                {/* Stats */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1.5 }}>
                    <Feather name="file-text" size={8} color={colors.textMuted} />
                    <Text style={{ fontSize: 8, color: colors.textMuted }}>{parseInt(project.totalDocs, 10) || 0}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1.5 }}>
                    <Feather name="camera" size={8} color={colors.textMuted} />
                    <Text style={{ fontSize: 8, color: colors.textMuted }}>{parseInt(project.totalPhotos, 10) || 0}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1.5 }}>
                    <Feather name="folder" size={8} color={colors.textMuted} />
                    <Text style={{ fontSize: 8, color: colors.textMuted }}>{parseInt(project.totalFolders, 10) || 0}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            {/* Add Create Project card — admin only */}
            {user.role === 'admin' && (
              <TouchableOpacity
                onPress={() => setIsCreating(true)}
                style={{ width: '22%', alignItems: 'center', gap: 4 }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    backgroundColor: 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderStyle: 'dashed',
                    borderColor: colors.primary,
                  }}
                >
                  <Feather name="plus" size={24} color={colors.primary} />
                </View>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '500',
                    color: colors.primary,
                    textAlign: 'center',
                    lineHeight: 13,
                  }}
                >
                  Create Project
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {filteredProjects.length === 0 && (
            <View style={{ marginTop: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                {searchQuery ? 'No projects match your search.' : t('dashboard.noProjects')}
              </Text>
            </View>
          )}
        </ScrollView>
        {/* Create Project Modal */}
        <Modal visible={isCreating} animationType="fade" transparent>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}
              onPress={() => setIsCreating(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border }}
                onPress={(e) => e.stopPropagation()}
              >
                <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 16 }}>Create New Project</Text>

                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Project Name (max 25)</Text>
                  <TextInput
                    style={{ backgroundColor: colors.background, color: colors.text, padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}
                    placeholder="E.g. Alpha Tower"
                    placeholderTextColor={colors.textMuted}
                    value={newProject.name}
                    maxLength={25}
                    onChangeText={(text) => setNewProject({ ...newProject, name: text })}
                  />

                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Description (max 50)</Text>
                  <TextInput
                    style={{ backgroundColor: colors.background, color: colors.text, padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}
                    placeholder="Short description"
                    placeholderTextColor={colors.textMuted}
                    value={newProject.description}
                    maxLength={50}
                    onChangeText={(text) => setNewProject({ ...newProject, description: text })}
                  />

                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Start Date (YYYY-MM-DD)</Text>
                  <TouchableOpacity
                    style={{ backgroundColor: colors.background, padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}
                    onPress={() => setShowStartPicker(true)}
                  >
                    <Text style={{ color: newProject.start_date ? colors.text : colors.textMuted }}>
                      {newProject.start_date || 'Select Start Date'}
                    </Text>
                  </TouchableOpacity>

                  {showStartPicker && (
                    <DateTimePicker
                      value={newProject.start_date ? new Date(newProject.start_date) : new Date()}
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowStartPicker(Platform.OS === 'ios');
                        if (selectedDate) {
                          setNewProject({ ...newProject, start_date: selectedDate.toISOString().split('T')[0] });
                        }
                      }}
                    />
                  )}

                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>End Date (YYYY-MM-DD)</Text>
                  <TouchableOpacity
                    style={{ backgroundColor: colors.background, padding: 12, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}
                    onPress={() => setShowEndPicker(true)}
                  >
                    <Text style={{ color: newProject.end_date ? colors.text : colors.textMuted }}>
                      {newProject.end_date || 'Select End Date'}
                    </Text>
                  </TouchableOpacity>

                  {showEndPicker && (
                    <DateTimePicker
                      value={newProject.end_date ? new Date(newProject.end_date) : new Date()}
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowEndPicker(Platform.OS === 'ios');
                        if (selectedDate) {
                          setNewProject({ ...newProject, end_date: selectedDate.toISOString().split('T')[0] });
                        }
                      }}
                    />
                  )}

                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                    <TouchableOpacity onPress={() => setIsCreating(false)} style={{ padding: 12 }}>
                      <Text style={{ color: colors.textMuted, fontWeight: 'bold' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleCreate}
                      disabled={isSubmitting}
                      style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 8, paddingHorizontal: 20, justifyContent: 'center' }}
                    >
                      {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Create</Text>}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </TouchableOpacity>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </Modal>


      </SafeAreaView >

      <LogoPreviewModal
        visible={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        logoSource={logoUri ? { uri: logoUri } : (user.role === 'superadmin' ? require('../../assets/images/icon.png') : null)}
        canChange={user.role === 'admin'}
        onChangePress={() => {
          setIsPreviewOpen(false);
          handleLogoUpload();
        }}
      />

      <LogoPreviewModal
        visible={isProfilePreviewOpen}
        onClose={() => setIsProfilePreviewOpen(false)}
        logoSource={profileUri ? { uri: profileUri } : null}
        canChange={false}
        onChangePress={() => { }}
        isCircular={true}
        title="Profile Picture"
        subtitle="This picture helps your team identify you on the platform."
      />

      {/* Org Selection Modal for Superadmin */}
      <Modal visible={isOrgDropdownOpen} animationType="fade" transparent>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsOrgDropdownOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
        >
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, width: '100%', maxWidth: 400, padding: 10, overflow: 'hidden' }}>
            <View style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>Select Organization</Text>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              <TouchableOpacity
                onPress={() => { setSelectedOrgId(null); setIsOrgDropdownOpen(false); }}
                style={{ padding: 15, backgroundColor: selectedOrgId === null ? colors.background : 'transparent' }}
              >
                <Text style={{ fontSize: 14, color: colors.text, fontWeight: selectedOrgId === null ? 'bold' : 'normal' }}>All Organizations</Text>
              </TouchableOpacity>
              {organizations.map((org) => (
                <TouchableOpacity
                  key={org.id}
                  onPress={() => { setSelectedOrgId(org.id); setIsOrgDropdownOpen(false); }}
                  style={{ padding: 15, backgroundColor: selectedOrgId === org.id ? colors.background : 'transparent' }}
                >
                  <Text style={{ fontSize: 14, color: colors.text, fontWeight: selectedOrgId === org.id ? 'bold' : 'normal' }}>{org.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
