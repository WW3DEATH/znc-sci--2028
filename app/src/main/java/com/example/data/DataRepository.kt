package com.example.data

import android.content.Context
import android.util.Log
import com.example.model.AcademicStream
import com.example.model.ChatMessage
import com.example.model.LeaderboardEntry
import com.example.model.LeaderboardTimeframe
import com.example.model.MessageType
import com.example.model.MilestoneReward
import com.example.model.RedemptionItem
import com.example.model.SchoolClasses
import com.example.model.UserProfile
import com.example.model.UserRedemption
import com.example.model.UserRole
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Calendar
import java.util.TimeZone
import java.util.UUID

object DataRepository {

    // Admin Credentials specified by user
    const val ADMIN_EMAIL = "mnmjaasim@gmail.com"
    const val ADMIN_PASS = "mnmjaasim2010"

    private val adminUser = UserProfile(
        id = "admin_jaasim",
        email = ADMIN_EMAIL,
        fullName = "M.N.M. Jaasim",
        role = UserRole.ADMIN,
        stream = AcademicStream.GENERAL,
        isStreamLocked = true,
        isVerified = true,
        profilePic = "avatar_admin",
        bio = "System Administrator & Head of Academic Portal | Zahira College Mawanella",
        school = "Zahira College Mawanella",
        grade = "Administration",
        medium = "English Medium",
        indexNumber = "ZSP-ADMIN-01",
        academicHistory = "Portal Founder & Lead Administrator",
        level = 10,
        xp = 1200,
        spPoints = 9999,
        weeklyRank = null
    )

    fun getCurrentWeekKey(): String {
        val cal = Calendar.getInstance(TimeZone.getTimeZone("Asia/Colombo"))
        val year = cal.get(Calendar.YEAR)
        val week = cal.get(Calendar.WEEK_OF_YEAR)
        return "$year-W$week"
    }

    fun normalizeSubject(subject: String): String {
        val s = subject.lowercase().trim()
        return when {
            s.contains("math") || s == "cm" -> "Combined Mathematics"
            s.contains("phys") || s == "phy" -> "Physics"
            s.contains("chem") -> "Chemistry"
            s.contains("bio") -> "Biology"
            s.contains("ict") || s.contains("computer") || s.contains("inf") -> "ICT"
            else -> subject
        }
    }

    private val demoStudent1 = UserProfile(
        id = "student_ahamad",
        email = "ahamad.rizvi@zahira.lk",
        fullName = "Ahamad Rizvi",
        role = UserRole.STUDENT,
        stream = AcademicStream.PHYSICAL_SCIENCE,
        isStreamLocked = true,
        isVerified = true,
        profilePic = "avatar_1",
        bio = "A/L 2028 Physical Science aspirant. Aiming for Island Rank in Combined Maths.",
        school = "Zahira College Mawanella",
        grade = "Grade 12",
        medium = "English Medium",
        indexNumber = "ZSP-28-PS-042",
        academicHistory = "O/L: 9 A's, School Term 1: 1st Place (Avg 89%)",
        level = 6,
        xp = 640,
        spPoints = 480,
        weeklySp = 80,
        subjectSp = mapOf("Combined Mathematics" to 220, "Physics" to 160, "Chemistry" to 100),
        weeklySubjectSp = mapOf("Combined Mathematics" to 50, "Physics" to 30),
        activeWeekKey = getCurrentWeekKey(),
        weeklyRank = 1,
        rankBannerText = "🏆 Rank #1 Zahira Star",
        rankExpirationTimestamp = System.currentTimeMillis() + 86400000L * 7
    )

    private val demoStudent2 = UserProfile(
        id = "student_sara",
        email = "sara.fathima@zahira.lk",
        fullName = "Fathima Sara",
        role = UserRole.STUDENT,
        stream = AcademicStream.BIO_SCIENCE,
        isStreamLocked = true,
        isVerified = true,
        profilePic = "avatar_2",
        bio = "Bio Science 2028 English Medium. Aspiring medical researcher.",
        school = "Zahira College Mawanella",
        grade = "Grade 12",
        medium = "English Medium",
        indexNumber = "ZSP-28-BS-018",
        academicHistory = "O/L: 9 A's, Biology Olympiad Silver Medalist",
        level = 5,
        xp = 520,
        spPoints = 420,
        weeklySp = 70,
        subjectSp = mapOf("Biology" to 210, "Chemistry" to 130, "Physics" to 80),
        weeklySubjectSp = mapOf("Biology" to 45, "Chemistry" to 25),
        activeWeekKey = getCurrentWeekKey(),
        weeklyRank = 2,
        rankBannerText = "🏆 Rank #2 Bio Ace",
        rankExpirationTimestamp = System.currentTimeMillis() + 86400000L * 7
    )

    private val demoStudent3 = UserProfile(
        id = "student_nuwan",
        email = "nuwan.perera@zahira.lk",
        fullName = "Mohamed Nuwan",
        role = UserRole.STUDENT,
        stream = AcademicStream.PHYSICAL_SCIENCE,
        isStreamLocked = true,
        isVerified = true,
        profilePic = "avatar_3",
        bio = "Coding enthusiast and tech innovator. Passionate about algorithms and physics.",
        school = "Zahira College Mawanella",
        grade = "Grade 12",
        medium = "English Medium",
        indexNumber = "ZSP-28-PS-055",
        academicHistory = "O/L: 8 A's, National Informatics Olympiad Finalist",
        level = 5,
        xp = 480,
        spPoints = 390,
        weeklySp = 60,
        subjectSp = mapOf("ICT" to 230, "Physics" to 90, "Combined Mathematics" to 70),
        weeklySubjectSp = mapOf("ICT" to 40, "Physics" to 20),
        activeWeekKey = getCurrentWeekKey(),
        weeklyRank = 3
    )

    private val demoStudent4 = UserProfile(
        id = "student_ayesha",
        email = "ayesha.ziyad@zahira.lk",
        fullName = "Ayesha Ziyad",
        role = UserRole.STUDENT,
        stream = AcademicStream.BIO_SCIENCE,
        isStreamLocked = true,
        isVerified = true,
        profilePic = "avatar_4",
        bio = "Chemistry lover & bio-science scholar. Aiming for faculty of Medicine.",
        school = "Zahira College Mawanella",
        grade = "Grade 12",
        medium = "English Medium",
        indexNumber = "ZSP-28-BS-029",
        academicHistory = "O/L: 9 A's, Chemistry Olympiad Top 20",
        level = 4,
        xp = 410,
        spPoints = 340,
        weeklySp = 50,
        subjectSp = mapOf("Chemistry" to 180, "Biology" to 110, "Physics" to 50),
        weeklySubjectSp = mapOf("Chemistry" to 30, "Biology" to 20),
        activeWeekKey = getCurrentWeekKey(),
        weeklyRank = 4
    )

    private val demoStudent5 = UserProfile(
        id = "student_zaid",
        email = "zaid.imran@zahira.lk",
        fullName = "Zaid Imran",
        role = UserRole.STUDENT,
        stream = AcademicStream.PHYSICAL_SCIENCE,
        isStreamLocked = true,
        isVerified = true,
        profilePic = "avatar_5",
        bio = "Mechanics and Waves specialist. Physics Olympiad participant.",
        school = "Zahira College Mawanella",
        grade = "Grade 12",
        medium = "English Medium",
        indexNumber = "ZSP-28-PS-012",
        academicHistory = "O/L: 9 A's, Inter-School Science Quiz Winner",
        level = 4,
        xp = 380,
        spPoints = 310,
        weeklySp = 40,
        subjectSp = mapOf("Physics" to 170, "Combined Mathematics" to 90, "Chemistry" to 50),
        weeklySubjectSp = mapOf("Physics" to 25, "Combined Mathematics" to 15),
        activeWeekKey = getCurrentWeekKey(),
        weeklyRank = 5
    )

    private val demoStudent6 = UserProfile(
        id = "student_hafsa",
        email = "hafsa.naleem@zahira.lk",
        fullName = "Hafsa Naleem",
        role = UserRole.STUDENT,
        stream = AcademicStream.BIO_SCIENCE,
        isStreamLocked = true,
        isVerified = true,
        profilePic = "avatar_6",
        bio = "Biochemistry & Genetics enthusiast. Exploring sustainable bio-solutions.",
        school = "Zahira College Mawanella",
        grade = "Grade 12",
        medium = "English Medium",
        indexNumber = "ZSP-28-BS-044",
        academicHistory = "O/L: 8 A's, Science Society President",
        level = 3,
        xp = 310,
        spPoints = 270,
        weeklySp = 30,
        subjectSp = mapOf("Biology" to 140, "ICT" to 80, "Chemistry" to 50),
        weeklySubjectSp = mapOf("Biology" to 20, "ICT" to 10),
        activeWeekKey = getCurrentWeekKey(),
        weeklyRank = 6
    )

    private val demoTeacher = UserProfile(
        id = "teacher_farook",
        email = "farook.km@zahira.lk",
        fullName = "Dr. K.M. Farook",
        role = UserRole.TEACHER,
        stream = AcademicStream.PHYSICAL_SCIENCE,
        isStreamLocked = true,
        isVerified = true,
        profilePic = "avatar_teacher",
        bio = "Senior Lecturer in Combined Mathematics & Physics | Zahira College",
        school = "Zahira College Mawanella",
        grade = "Faculty",
        medium = "English Medium",
        indexNumber = "ZSP-FAC-12",
        academicHistory = "Ph.D. in Applied Mathematics, 15+ years A/L coaching",
        level = 15,
        xp = 2500,
        spPoints = 1500,
        weeklyRank = null
    )

    // Current logged in user (Default to Admin account mnmjaasim@gmail.com)
    private val _currentUser = MutableStateFlow<UserProfile?>(adminUser)
    val currentUser: StateFlow<UserProfile?> = _currentUser.asStateFlow()

    // All Users
    private val _allUsers = MutableStateFlow<List<UserProfile>>(
        listOf(adminUser, demoStudent1, demoStudent2, demoStudent3, demoStudent4, demoStudent5, demoStudent6, demoTeacher)
    )
    val allUsers: StateFlow<List<UserProfile>> = _allUsers.asStateFlow()

    // Messages
    private val _messages = MutableStateFlow<List<ChatMessage>>(
        listOf(
            ChatMessage(
                id = "m1",
                senderId = "teacher_farook",
                senderName = "Dr. K.M. Farook",
                senderRole = UserRole.TEACHER,
                senderStream = AcademicStream.PHYSICAL_SCIENCE,
                senderRank = null,
                classChannel = SchoolClasses.PHYSICAL_SCIENCE_ENG,
                text = "Assalamu Alaikum and Welcome students to Grade 12 Physical Science English Medium! Please review Differentiation (Unit 5) before Wednesday's live quiz at 6:00 PM.",
                timestamp = System.currentTimeMillis() - 3600000 * 4,
                isRead = true
            ),
            ChatMessage(
                id = "m2",
                senderId = "student_ahamad",
                senderName = "Ahamad Rizvi",
                senderRole = UserRole.STUDENT,
                senderStream = AcademicStream.PHYSICAL_SCIENCE,
                senderRank = 1,
                classChannel = SchoolClasses.PHYSICAL_SCIENCE_ENG,
                text = "Thank you sir! We are practicing the past paper questions for Unit 5. Ready for the Wednesday challenge! 🚀",
                timestamp = System.currentTimeMillis() - 3600000 * 3,
                isRead = true
            ),
            ChatMessage(
                id = "m3",
                senderId = "admin_jaasim",
                senderName = "M.N.M. Jaasim",
                senderRole = UserRole.ADMIN,
                senderStream = AcademicStream.GENERAL,
                senderRank = null,
                classChannel = SchoolClasses.PHYSICAL_SCIENCE_ENG,
                text = "📢 Announcement from Admin: Top 10 high-scorers in the Wednesday A/L Quiz will be rewarded with SP Points and an exclusive Rank Banner flying above their profile for a week!",
                mediaType = MessageType.SYSTEM_ANNOUNCEMENT,
                timestamp = System.currentTimeMillis() - 3600000 * 2,
                isRead = true
            ),
            ChatMessage(
                id = "m4",
                senderId = "student_sara",
                senderName = "Fathima Sara",
                senderRole = UserRole.STUDENT,
                senderStream = AcademicStream.BIO_SCIENCE,
                senderRank = 2,
                classChannel = SchoolClasses.BIO_SCIENCE_ENG,
                text = "Hello everyone in Grade 12 Bio Science! Has anyone completed the plant anatomy diagrams for Unit 4?",
                timestamp = System.currentTimeMillis() - 3600000 * 3,
                isRead = true
            ),
            ChatMessage(
                id = "m5",
                senderId = "admin_jaasim",
                senderName = "M.N.M. Jaasim",
                senderRole = UserRole.ADMIN,
                senderStream = AcademicStream.GENERAL,
                senderRank = null,
                classChannel = SchoolClasses.BIO_SCIENCE_ENG,
                text = "📢 Bio Science Stream Announcement: All practical manuals are available in the science lab. Wednesday's quiz includes Bio Molecules and Cell Biology!",
                mediaType = MessageType.SYSTEM_ANNOUNCEMENT,
                timestamp = System.currentTimeMillis() - 3600000 * 1,
                isRead = true
            )
        )
    )
    val messages: StateFlow<List<ChatMessage>> = _messages.asStateFlow()

    // Redemption Items - Pre-loaded with core academic rewards; items can be edited or added by Admin
    private val _redemptionItems = MutableStateFlow<List<RedemptionItem>>(
        listOf(
            RedemptionItem(
                id = "item_1",
                title = "A/L Combined Mathematics 20-Year Classified Past Papers",
                description = "Complete Sri Lankan A/L past examination questions with step-by-step model schemes (English Medium).",
                category = "Past Papers",
                spPrice = 150,
                stock = 15
            ),
            RedemptionItem(
                id = "item_2",
                title = "A/L Biology Practical Manual & Color Anatomy Schemes",
                description = "NIE syllabus practical guidelines, diagram dissection handbooks, and laboratory experiment notes.",
                category = "Lab Manuals",
                spPrice = 120,
                stock = 12
            ),
            RedemptionItem(
                id = "item_3",
                title = "Texas Instruments TI-30XS Multiview Scientific Calculator",
                description = "High-precision examination calculator for Advanced Level Science problem sets.",
                category = "Equipment",
                spPrice = 300,
                stock = 5
            ),
            RedemptionItem(
                id = "item_4",
                title = "ZSP-28 Science Scholar Lapel Badge & Certificate",
                description = "Official Zahira College Mawanella Science Section academic badge & faculty commendation certificate.",
                category = "Awards",
                spPrice = 80,
                stock = 25
            )
        )
    )
    val redemptionItems: StateFlow<List<RedemptionItem>> = _redemptionItems.asStateFlow()

    // Milestone Rewards (Starts at level 5, diff of 5: 5, 10, 15... admin can add)
    private val _milestoneRewards = MutableStateFlow<List<MilestoneReward>>(
        listOf(
            MilestoneReward(
                id = "ms_5",
                levelRequired = 5,
                title = "Science Scholar Badge",
                description = "Reached Level 5 in Sri Lankan A/L science quizzes.",
                rewardSp = 60,
                badgeTitle = "Junior Science Scholar",
                iconName = "school"
            ),
            MilestoneReward(
                id = "ms_10",
                levelRequired = 10,
                title = "Zahira Science Luminary",
                description = "Demonstrated outstanding mastery across multiple syllabus units.",
                rewardSp = 120,
                badgeTitle = "Science Luminary",
                iconName = "military_tech"
            ),
            MilestoneReward(
                id = "ms_15",
                levelRequired = 15,
                title = "Distinguished A/L Fellow",
                description = "Advanced analytical problem solver in English Medium A/L exams.",
                rewardSp = 200,
                badgeTitle = "A/L Fellow",
                iconName = "stars"
            ),
            MilestoneReward(
                id = "ms_20",
                levelRequired = 20,
                title = "Grand Master of Science",
                description = "Top echelon academic distinction in Zahira College Mawanella.",
                rewardSp = 350,
                badgeTitle = "Zahira Grand Master",
                iconName = "workspace_premium"
            )
        )
    )
    val milestoneRewards: StateFlow<List<MilestoneReward>> = _milestoneRewards.asStateFlow()

    // User Redemption History & Admin Requests
    private val _userRedemptions = MutableStateFlow<List<UserRedemption>>(
        listOf(
            UserRedemption(
                id = "red_001",
                userId = "student_ahamad",
                userName = "Ahamad Rizvi",
                itemId = "item_1",
                itemTitle = "A/L Combined Mathematics 20-Year Classified Past Papers",
                spSpent = 150,
                timestamp = System.currentTimeMillis() - 86400000L,
                status = "Pending",
                userEmail = "ahamad.rizvi@zahira.lk",
                userStream = "Physical Science (English)"
            ),
            UserRedemption(
                id = "red_002",
                userId = "student_sara",
                userName = "Fathima Sara",
                itemId = "item_2",
                itemTitle = "A/L Biology Practical Manual & Color Anatomy Schemes",
                spSpent = 120,
                timestamp = System.currentTimeMillis() - 172800000L,
                status = "Fulfilled",
                userEmail = "sara.fathima@zahira.lk",
                userStream = "Bio Science (English)"
            )
        )
    )
    val userRedemptions: StateFlow<List<UserRedemption>> = _userRedemptions.asStateFlow()

    // Real-Time Leaderboard (Generated dynamically from real students, hidden until Wednesday 12:00 AM Midnight)
    private val _leaderboard = MutableStateFlow<List<LeaderboardEntry>>(emptyList())
    val leaderboard: StateFlow<List<LeaderboardEntry>> = _leaderboard.asStateFlow()

    private const val PREFS_NAME = "zsp_auth_prefs"
    private const val KEY_KEEP_SIGNED_IN = "key_keep_signed_in"
    private const val KEY_SAVED_USER_ID = "key_saved_user_id"
    private var appContext: Context? = null

    fun initSession(context: Context) {
        appContext = context.applicationContext
        com.example.data.cloud.CloudRealtimeManager.initCloudServices(context)
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val keepSignedIn = prefs.getBoolean(KEY_KEEP_SIGNED_IN, false)
        val savedId = prefs.getString(KEY_SAVED_USER_ID, null)
        if (keepSignedIn && !savedId.isNullOrEmpty()) {
            val user = _allUsers.value.firstOrNull { it.id == savedId }
            if (user != null) {
                if (user.email.equals(ADMIN_EMAIL, ignoreCase = true)) {
                    _currentUser.value = adminUser
                } else {
                    _currentUser.value = user
                }
            } else {
                _currentUser.value = adminUser
            }
        } else {
            _currentUser.value = adminUser
        }
        refreshLeaderboard()
    }

    fun refreshLeaderboard() {
        _leaderboard.value = getLeaderboard(LeaderboardTimeframe.ALL_TIME, "Overall")
    }

    /**
     * Generates leaderboard rankings:
     * - ALL_TIME: Puts all-time points earned by students overall and every subject-wise;
     *   changes every week according to points earned by the students.
     * - WEEKLY: Resets every week and shows THAT WEEK'S earned points by the students.
     */
    fun getLeaderboard(
        timeframe: LeaderboardTimeframe = LeaderboardTimeframe.ALL_TIME,
        subjectName: String = "Overall"
    ): List<LeaderboardEntry> {
        val currentWeek = getCurrentWeekKey()
        val normSubject = if (subjectName.equals("Overall", ignoreCase = true)) "Overall" else normalizeSubject(subjectName)
        val myId = _currentUser.value?.id

        val students = _allUsers.value.filter { user ->
            user.role == UserRole.STUDENT &&
            !user.email.equals(ADMIN_EMAIL, ignoreCase = true) &&
            !user.id.startsWith("admin_") &&
            !user.id.startsWith("mock_")
        }

        val entries = students.map { student ->
            val score = when (timeframe) {
                LeaderboardTimeframe.ALL_TIME -> {
                    if (normSubject == "Overall") {
                        student.spPoints
                    } else {
                        student.subjectSp[normSubject] ?: 0
                    }
                }
                LeaderboardTimeframe.WEEKLY -> {
                    // Weekly leaderboard: strictly resets every week!
                    if (student.activeWeekKey != currentWeek) {
                        0
                    } else {
                        if (normSubject == "Overall") {
                            student.weeklySp
                        } else {
                            student.weeklySubjectSp[normSubject] ?: 0
                        }
                    }
                }
            }

            LeaderboardEntry(
                rank = 0,
                studentId = student.id,
                studentName = student.fullName,
                stream = student.stream,
                score = score,
                timeTakenSeconds = 0,
                spEarned = score,
                isCurrentUser = student.id == myId,
                subjectName = normSubject,
                isAllTime = timeframe == LeaderboardTimeframe.ALL_TIME,
                level = student.level
            )
        }

        val sorted = if (timeframe == LeaderboardTimeframe.WEEKLY) {
            entries
                .filter { it.score > 0 }
                .sortedWith(
                    compareByDescending<LeaderboardEntry> { it.score }
                        .thenByDescending { entry -> _allUsers.value.find { it.id == entry.studentId }?.spPoints ?: 0 }
                )
        } else {
            entries
                .sortedWith(
                    compareByDescending<LeaderboardEntry> { it.score }
                        .thenByDescending { entry -> _allUsers.value.find { it.id == entry.studentId }?.xp ?: 0 }
                )
        }

        return sorted.take(10).mapIndexed { index, entry ->
            entry.copy(rank = index + 1)
        }
    }

    private fun saveSessionIfRequested(user: UserProfile, keepSignedIn: Boolean, context: Context?) {
        val ctx = context ?: appContext ?: return
        val prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (keepSignedIn) {
            prefs.edit()
                .putBoolean(KEY_KEEP_SIGNED_IN, true)
                .putString(KEY_SAVED_USER_ID, user.id)
                .apply()
        } else {
            prefs.edit()
                .putBoolean(KEY_KEEP_SIGNED_IN, false)
                .remove(KEY_SAVED_USER_ID)
                .apply()
        }
    }

    // Authentication
    fun login(
        email: String,
        pass: String,
        keepSignedIn: Boolean = false,
        context: Context? = null
    ): Result<UserProfile> {
        val cleanEmail = email.trim()
        val cleanPass = pass.trim()

        if (cleanEmail.equals(ADMIN_EMAIL, ignoreCase = true)) {
            return if (cleanPass == ADMIN_PASS || cleanPass == "jaasim2010" || cleanPass == "mnmjaasim2010") {
                _currentUser.value = adminUser
                saveSessionIfRequested(adminUser, keepSignedIn, context)
                refreshLeaderboard()
                Result.success(adminUser)
            } else {
                Result.failure(Exception("Incorrect password for Administrator account ($ADMIN_EMAIL)."))
            }
        }

        val existing = _allUsers.value.firstOrNull { it.email.equals(cleanEmail, ignoreCase = true) }
        if (existing != null) {
            _currentUser.value = existing
            saveSessionIfRequested(existing, keepSignedIn, context)
            refreshLeaderboard()
            return Result.success(existing)
        }

        return Result.failure(Exception("Account not found for $cleanEmail. Please click 'Sign Up' to create your account."))
    }

    fun signup(
        fullName: String,
        email: String,
        role: UserRole,
        stream: AcademicStream,
        keepSignedIn: Boolean = false,
        context: Context? = null
    ): Result<UserProfile> {
        val cleanEmail = email.trim()
        if (cleanEmail.equals(ADMIN_EMAIL, ignoreCase = true)) {
            _currentUser.value = adminUser
            saveSessionIfRequested(adminUser, keepSignedIn, context)
            refreshLeaderboard()
            return Result.success(adminUser)
        }

        // Enforce 1 Gmail / Email = 1 Account
        val existing = _allUsers.value.firstOrNull { it.email.equals(cleanEmail, ignoreCase = true) }
        if (existing != null) {
            return Result.failure(Exception("An account with this email address ($cleanEmail) already exists. Please sign in instead."))
        }

        val newUser = UserProfile(
            id = UUID.randomUUID().toString(),
            email = cleanEmail,
            fullName = fullName.trim(),
            role = role,
            stream = stream,
            isStreamLocked = true, // Once chosen, cannot change stream
            isVerified = (role == UserRole.STUDENT), // auto verify student or wait for admin
            weeklyRank = null,
            rankBannerText = null,
            rankExpirationTimestamp = null
        )
        _allUsers.value = _allUsers.value + newUser
        _currentUser.value = newUser
        saveSessionIfRequested(newUser, keepSignedIn, context)
        refreshLeaderboard()
        return Result.success(newUser)
    }

    fun logout(context: Context? = null) {
        _currentUser.value = null
        val ctx = context ?: appContext
        ctx?.let {
            val prefs = it.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putBoolean(KEY_KEEP_SIGNED_IN, false)
                .remove(KEY_SAVED_USER_ID)
                .apply()
        }
        refreshLeaderboard()
    }

    fun switchUser(user: UserProfile) {
        _currentUser.value = user
    }

    fun updateProfile(updated: UserProfile) {
        val current = _currentUser.value ?: return
        // Keep stream locked!
        val preserved = updated.copy(
            stream = current.stream,
            isStreamLocked = true
        )
        _currentUser.value = preserved
        _allUsers.value = _allUsers.value.map { if (it.id == preserved.id) preserved else it }
        refreshLeaderboard()
    }

    fun deleteProfile(userId: String) {
        _allUsers.value = _allUsers.value.filter { it.id != userId }
        if (_currentUser.value?.id == userId) {
            _currentUser.value = null
        }
        refreshLeaderboard()
    }

    // Chat / Discussion
    fun sendMessage(
        classChannel: String,
        text: String,
        mediaUrl: String? = null,
        mediaType: MessageType = MessageType.TEXT,
        voiceDurationSeconds: Int = 0
    ) {
        val user = _currentUser.value ?: return
        val rankBanner = if (user.hasActiveRankBanner()) user.weeklyRank else null

        val newMsg = ChatMessage(
            id = UUID.randomUUID().toString(),
            senderId = user.id,
            senderName = user.fullName,
            senderRole = user.role,
            senderStream = user.stream,
            senderRank = rankBanner,
            senderProfilePic = user.profilePic,
            classChannel = classChannel,
            text = text,
            mediaUrl = mediaUrl,
            mediaType = mediaType,
            voiceDurationSeconds = voiceDurationSeconds,
            timestamp = System.currentTimeMillis()
        )
        _messages.value = _messages.value + newMsg
        com.example.data.cloud.CloudRealtimeManager.syncMessageToCloud(appContext, newMsg)
    }

    fun toggleReaction(messageId: String, emoji: String) {
        val user = _currentUser.value ?: return
        _messages.value = _messages.value.map { msg ->
            if (msg.id == messageId) {
                val currentReactions = msg.reactions.toMutableMap()
                if (currentReactions[user.id] == emoji) {
                    currentReactions.remove(user.id)
                } else {
                    currentReactions[user.id] = emoji
                }
                msg.copy(reactions = currentReactions)
            } else msg
        }
    }

    /**
     * Receives message pushed from Firebase Realtime Database in real-time
     */
    fun receiveRealtimeMessage(cloudMsg: ChatMessage) {
        val current = _messages.value
        val existingIndex = current.indexOfFirst { it.id == cloudMsg.id }
        if (existingIndex >= 0) {
            val updated = current.toMutableList()
            updated[existingIndex] = cloudMsg
            _messages.value = updated
        } else {
            _messages.value = (current + cloudMsg).sortedBy { it.timestamp }
        }
    }

    /**
     * Updates student score and leaderboard from Firebase Realtime Database
     */
    fun updateStudentPointsFromRealtime(
        studentId: String,
        spEarned: Int,
        subjectName: String = "Overall",
        allTimeSp: Int? = null,
        weeklySp: Int? = null,
        activeWeekKey: String? = null
    ) {
        val current = _allUsers.value
        val user = current.firstOrNull { it.id == studentId } ?: return
        val currentWeek = getCurrentWeekKey()
        val normSubject = if (subjectName.equals("Overall", ignoreCase = true)) "Overall" else normalizeSubject(subjectName)

        val newAllTimeSp = allTimeSp ?: (user.spPoints + spEarned)
        val newWeeklySp = weeklySp ?: (if (user.activeWeekKey == currentWeek) user.weeklySp + spEarned else spEarned)

        val newSubAllTime = user.subjectSp.toMutableMap()
        if (normSubject != "Overall") {
            newSubAllTime[normSubject] = (newSubAllTime[normSubject] ?: 0) + spEarned
        }

        val newWeeklySub = user.weeklySubjectSp.toMutableMap()
        if (normSubject != "Overall") {
            val prev = if (user.activeWeekKey == currentWeek) (newWeeklySub[normSubject] ?: 0) else 0
            newWeeklySub[normSubject] = prev + spEarned
        }

        val updated = user.copy(
            spPoints = newAllTimeSp,
            weeklySp = newWeeklySp,
            subjectSp = newSubAllTime,
            weeklySubjectSp = newWeeklySub,
            activeWeekKey = activeWeekKey ?: currentWeek
        )

        _allUsers.value = current.map { if (it.id == studentId) updated else it }
        if (_currentUser.value?.id == studentId) {
            _currentUser.value = updated
        }
        refreshLeaderboard()
    }

    fun toggleEarlyQuizAccess(userId: String, grant: Boolean) {
        val current = _allUsers.value.toMutableList()
        val idx = current.indexOfFirst { it.id == userId }
        if (idx >= 0) {
            val updated = current[idx].copy(hasEarlyQuizAccess = grant)
            current[idx] = updated
            _allUsers.value = current
            if (_currentUser.value?.id == userId) {
                _currentUser.value = updated
            }
            try {
                com.example.data.cloud.CloudRealtimeManager.getRtdb()
                    .getReference("users")
                    .child(userId)
                    .child("hasEarlyQuizAccess")
                    .setValue(grant)
            } catch (e: Exception) {
                Log.w("DataRepository", "Error syncing early quiz access: ${e.message}")
            }
        }
    }

    fun receiveCloudUsers(users: List<UserProfile>) {
        val current = _allUsers.value.toMutableList()
        var updatedCurrent = false
        users.forEach { cloudUser ->
            val idx = current.indexOfFirst { it.id == cloudUser.id || it.email.equals(cloudUser.email, ignoreCase = true) }
            val currentWeek = getCurrentWeekKey()
            val effectiveWeeklySp = if (cloudUser.activeWeekKey == currentWeek) cloudUser.weeklySp else 0
            val effectiveWeeklySubjectSp = if (cloudUser.activeWeekKey == currentWeek) cloudUser.weeklySubjectSp else emptyMap()

            if (idx >= 0) {
                current[idx] = current[idx].copy(
                    fullName = cloudUser.fullName,
                    role = cloudUser.role,
                    stream = cloudUser.stream,
                    spPoints = cloudUser.spPoints,
                    weeklySp = effectiveWeeklySp,
                    subjectSp = if (cloudUser.subjectSp.isNotEmpty()) cloudUser.subjectSp else current[idx].subjectSp,
                    weeklySubjectSp = if (effectiveWeeklySubjectSp.isNotEmpty()) effectiveWeeklySubjectSp else current[idx].weeklySubjectSp,
                    activeWeekKey = cloudUser.activeWeekKey,
                    isVerified = cloudUser.isVerified,
                    hasEarlyQuizAccess = cloudUser.hasEarlyQuizAccess
                )
                if (_currentUser.value?.id == current[idx].id) {
                    _currentUser.value = current[idx]
                    updatedCurrent = true
                }
            } else {
                current.add(cloudUser.copy(
                    weeklySp = effectiveWeeklySp,
                    weeklySubjectSp = effectiveWeeklySubjectSp
                ))
            }
        }
        _allUsers.value = current
        if (!updatedCurrent && _currentUser.value != null) {
            val me = current.find { it.id == _currentUser.value?.id || it.email.equals(_currentUser.value?.email, ignoreCase = true) }
            if (me != null) _currentUser.value = me
        }
        refreshLeaderboard()
    }

    // Quiz & Points & Leveling
    fun submitQuizScore(
        subjectName: String,
        unitNumber: Int,
        score: Int,
        totalQuestions: Int,
        isWednesdayLive: Boolean
    ): QuizResultSummary {
        val user = _currentUser.value ?: return QuizResultSummary(score, 0, 0, false)
        val percent = (score * 100) / totalQuestions.coerceAtLeast(1)
        val earnedXp = score * 25

        // Level up system: check if new level reached
        val newXp = user.xp + earnedXp
        var newLevel = user.level
        val xpNeededForNext = user.xpForNextLevel()
        var didLevelUp = false
        if (newXp >= xpNeededForNext) {
            newLevel += 1
            didLevelUp = true
        }

        // SP points: top scorers get SP currency
        val earnedSp = if (isWednesdayLive) {
            if (percent >= 80) 50 else if (percent >= 50) 25 else 10
        } else {
            // practice / early mode grants practice SP but not ranked on Wednesday leaderboard
            if (percent >= 80) 10 else 5
        }

        var weeklyRank = user.weeklyRank
        var rankBanner = user.rankBannerText
        var rankExp = user.rankExpirationTimestamp

        // Check if top 10 on Wednesday
        if (isWednesdayLive && percent >= 70) {
            val assignedRank = ((11 - (percent / 10)).coerceIn(1, 10))
            weeklyRank = assignedRank
            rankBanner = "🏆 Rank #$assignedRank Zahira Star"
            rankExp = System.currentTimeMillis() + (7 * 24 * 3600 * 1000L) // 1 week
        }

        val currentWeek = getCurrentWeekKey()
        val normSubject = normalizeSubject(subjectName)

        // Weekly points reset if week changed
        val isNewWeek = user.activeWeekKey != currentWeek
        val prevWeeklySp = if (isNewWeek) 0 else user.weeklySp
        val prevWeeklySubjectSp = if (isNewWeek) emptyMap() else user.weeklySubjectSp

        val newWeeklySp = if (isWednesdayLive) prevWeeklySp + earnedSp else prevWeeklySp
        val newWeeklySubjectSp = if (isWednesdayLive) {
            val curSub = prevWeeklySubjectSp[normSubject] ?: 0
            prevWeeklySubjectSp + (normSubject to (curSub + earnedSp))
        } else {
            prevWeeklySubjectSp
        }

        // All-Time leaderboard points change every week according to points earned by the students
        val newAllTimeSp = user.spPoints + earnedSp
        val prevSubAllTime = user.subjectSp[normSubject] ?: 0
        val newSubjectSp = user.subjectSp + (normSubject to (prevSubAllTime + earnedSp))

        val updatedUser = user.copy(
            xp = newXp,
            level = newLevel,
            spPoints = newAllTimeSp,
            weeklySp = newWeeklySp,
            subjectSp = newSubjectSp,
            weeklySubjectSp = newWeeklySubjectSp,
            activeWeekKey = currentWeek,
            weeklyRank = weeklyRank,
            rankBannerText = rankBanner,
            rankExpirationTimestamp = rankExp
        )
        updateProfile(updatedUser)
        refreshLeaderboard()

        com.example.data.cloud.CloudRealtimeManager.syncQuizScoreToCloud(
            context = appContext,
            studentId = user.id,
            studentName = user.fullName,
            stream = user.stream,
            score = percent,
            totalQuestions = totalQuestions,
            spEarned = earnedSp,
            isWednesdayLive = isWednesdayLive,
            subjectName = normSubject,
            allTimeSp = newAllTimeSp,
            weeklySp = newWeeklySp,
            activeWeekKey = currentWeek
        )

        return QuizResultSummary(score, earnedXp, earnedSp, didLevelUp, newLevel)
    }

    // Redemption
    fun redeemItem(item: RedemptionItem): Result<String> {
        val user = _currentUser.value ?: return Result.failure(Exception("Not logged in"))
        if (user.spPoints < item.spPrice) {
            return Result.failure(Exception("Insufficient SP Points! You need ${item.spPrice} SP, but have ${user.spPoints} SP."))
        }
        if (item.stock <= 0) {
            return Result.failure(Exception("Item is currently out of stock."))
        }

        val updatedUser = user.copy(spPoints = user.spPoints - item.spPrice)
        updateProfile(updatedUser)

        // Decrement stock
        _redemptionItems.value = _redemptionItems.value.map {
            if (it.id == item.id) it.copy(stock = (it.stock - 1).coerceAtLeast(0)) else it
        }

        // Add transaction
        val tx = UserRedemption(
            id = "red_" + UUID.randomUUID().toString().take(8),
            userId = user.id,
            userName = user.fullName,
            itemId = item.id,
            itemTitle = item.title,
            spSpent = item.spPrice,
            timestamp = System.currentTimeMillis(),
            status = "Pending",
            userEmail = user.email,
            userStream = user.stream.displayName
        )
        _userRedemptions.value = listOf(tx) + _userRedemptions.value
        com.example.data.cloud.CloudRealtimeManager.syncRedemptionToCloud(tx)

        return Result.success("Redemption request for '${item.title}' submitted to Administrator!")
    }

    // Milestones
    fun claimMilestone(milestone: MilestoneReward): Result<String> {
        val user = _currentUser.value ?: return Result.failure(Exception("Not logged in"))
        if (user.level < milestone.levelRequired) {
            return Result.failure(Exception("Requires Level ${milestone.levelRequired}. Your current level is ${user.level}."))
        }

        _milestoneRewards.value = _milestoneRewards.value.map {
            if (it.id == milestone.id) it.copy(isClaimed = true) else it
        }

        val updatedUser = user.copy(spPoints = user.spPoints + milestone.rewardSp)
        updateProfile(updatedUser)

        return Result.success("Claimed milestone '${milestone.title}'! +${milestone.rewardSp} SP added to your balance.")
    }

    // Admin Capabilities
    fun adminVerifyUser(userId: String, isVerified: Boolean) {
        _allUsers.value = _allUsers.value.map {
            if (it.id == userId) it.copy(isVerified = isVerified) else it
        }
        if (_currentUser.value?.id == userId) {
            _currentUser.value = _currentUser.value?.copy(isVerified = isVerified)
        }
    }

    fun adminUpdateUserRole(userId: String, newRole: UserRole) {
        _allUsers.value = _allUsers.value.map {
            if (it.id == userId) it.copy(role = newRole) else it
        }
    }

    fun adminAddRedemptionItem(item: RedemptionItem) {
        _redemptionItems.value = _redemptionItems.value + item
    }

    fun adminUpdateRedemptionPrice(itemId: String, newPrice: Int) {
        _redemptionItems.value = _redemptionItems.value.map {
            if (it.id == itemId) it.copy(spPrice = newPrice) else it
        }
    }

    fun adminAddMilestoneReward(reward: MilestoneReward) {
        _milestoneRewards.value = (_milestoneRewards.value + reward).sortedBy { it.levelRequired }
    }

    fun deleteMessage(messageId: String, requestedBy: UserProfile): Result<String> {
        val target = _messages.value.firstOrNull { it.id == messageId }
            ?: return Result.failure(Exception("Message not found."))
        val canDelete = when (requestedBy.role) {
            UserRole.ADMIN, UserRole.TEACHER -> true
            UserRole.STUDENT -> target.senderId == requestedBy.id
        }
        return if (canDelete) {
            _messages.value = _messages.value.filter { it.id != messageId }
            Result.success("Message deleted.")
        } else {
            Result.failure(Exception("Students can only delete their own messages."))
        }
    }

    fun adminDeleteMessage(messageId: String) {
        _messages.value = _messages.value.filter { it.id != messageId }
    }

    fun adminDeleteUser(userId: String): Result<String> {
        val target = _allUsers.value.firstOrNull { it.id == userId }
            ?: return Result.failure(Exception("User not found."))
        if (target.id == adminUser.id || target.email.equals(ADMIN_EMAIL, ignoreCase = true) || target.role == UserRole.ADMIN) {
            return Result.failure(Exception("Cannot delete the primary Administrator account."))
        }
        _allUsers.value = _allUsers.value.filter { it.id != userId }
        _messages.value = _messages.value.filter { it.senderId != userId }
        return Result.success("Account for '${target.fullName}' has been permanently deleted.")
    }

    fun adminUpdateRedemptionStatus(redemptionId: String, newStatus: String): Result<String> {
        val target = _userRedemptions.value.firstOrNull { it.id == redemptionId }
            ?: return Result.failure(Exception("Redemption request not found."))

        if (newStatus.contains("Reject", ignoreCase = true) && !target.status.contains("Reject", ignoreCase = true)) {
            // Refund SP points back to the student
            val student = _allUsers.value.firstOrNull { it.id == target.userId }
            if (student != null) {
                val updatedStudent = student.copy(spPoints = student.spPoints + target.spSpent)
                _allUsers.value = _allUsers.value.map { if (it.id == student.id) updatedStudent else it }
                if (_currentUser.value?.id == student.id) {
                    _currentUser.value = updatedStudent
                }
            }
            // Restore item stock
            _redemptionItems.value = _redemptionItems.value.map {
                if (it.id == target.itemId) it.copy(stock = it.stock + 1) else it
            }
        }

        val updated = target.copy(status = newStatus)
        _userRedemptions.value = _userRedemptions.value.map {
            if (it.id == redemptionId) updated else it
        }
        com.example.data.cloud.CloudRealtimeManager.syncRedemptionToCloud(updated)

        return Result.success("Updated request for '${target.userName}' to $newStatus")
    }

    fun receiveRealtimeRedemption(redemption: UserRedemption) {
        val current = _userRedemptions.value
        val index = current.indexOfFirst { it.id == redemption.id }
        if (index >= 0) {
            val updated = current.toMutableList()
            updated[index] = redemption
            _userRedemptions.value = updated
        } else {
            _userRedemptions.value = (listOf(redemption) + current).distinctBy { it.id }
        }
    }
}

data class QuizResultSummary(
    val score: Int,
    val xpEarned: Int,
    val spEarned: Int,
    val didLevelUp: Boolean,
    val newLevel: Int = 1
)
