package com.example.model

enum class UserRole(val displayName: String) {
    STUDENT("Student"),
    TEACHER("Teacher"),
    ADMIN("Administrator")
}

enum class AcademicStream(val displayName: String) {
    PHYSICAL_SCIENCE("Physical Science"),
    BIO_SCIENCE("Bio Science"),
    GENERAL("General / Faculty")
}

object SchoolClasses {
    const val PHYSICAL_SCIENCE_ENG = "Grade 12 Physical Science English Medium"
    const val BIO_SCIENCE_ENG = "Grade 12 Bio Science English Medium"
}

data class UserProfile(
    val id: String,
    val email: String,
    val fullName: String,
    val role: UserRole,
    val stream: AcademicStream,
    val isStreamLocked: Boolean = true,
    val isVerified: Boolean = false,
    val profilePic: String = "avatar_1",
    val bio: String = "Striving for excellence at Zahira College Mawanella",
    val school: String = "Zahira College Mawanella",
    val grade: String = "Grade 12",
    val medium: String = "English Medium",
    val indexNumber: String = "ZSP-28-000",
    val academicHistory: String = "O/L: 9A's, Term 1 Combined Maths: 88, Physics: 84, Chemistry: 86",
    val level: Int = 1,
    val xp: Int = 120,
    val spPoints: Int = 150,
    val weeklySp: Int = 0,
    val subjectSp: Map<String, Int> = emptyMap(),
    val weeklySubjectSp: Map<String, Int> = emptyMap(),
    val activeWeekKey: String = "",
    val weeklySpHistory: Map<String, Int> = emptyMap(),
    val hasEarlyQuizAccess: Boolean = false,
    val weeklyRank: Int? = null, // 1 to 10 if rank banner is active
    val rankBannerText: String? = null,
    val rankExpirationTimestamp: Long? = null
) {
    fun hasActiveRankBanner(): Boolean {
        if (weeklyRank == null || weeklyRank <= 0 || weeklyRank > 10) return false
        val now = System.currentTimeMillis()
        val exp = rankExpirationTimestamp ?: return true
        return now <= exp
    }

    fun xpForNextLevel(): Int = level * 100

    fun targetClass(): String {
        return when (stream) {
            AcademicStream.PHYSICAL_SCIENCE -> SchoolClasses.PHYSICAL_SCIENCE_ENG
            AcademicStream.BIO_SCIENCE -> SchoolClasses.BIO_SCIENCE_ENG
            AcademicStream.GENERAL -> "All Streams"
        }
    }

    /**
     * Generates a realistic, continuous weekly SP trajectory across 6 weeks
     * for tracking improvement over time.
     */
    fun getWeeklySpTrendPoints(subject: String = "Overall"): List<WeeklyTrendPoint> {
        val totalSubjectSp = if (subject == "Overall") spPoints else (subjectSp[subject] ?: (spPoints / 3).coerceAtLeast(10))
        val currentWeekGain = if (subject == "Overall") weeklySp.coerceAtLeast(15) else (weeklySubjectSp[subject] ?: (weeklySp / 3).coerceAtLeast(5))

        // Natural growth ratios across 6 weekly cycles
        val ratios = listOf(0.12f, 0.20f, 0.35f, 0.52f, 0.74f, 1.0f)
        val weekNames = listOf("W34 (Term Start)", "W35", "W36", "W37", "W38", "W39 (Active)")

        var prevSp = 0
        return weekNames.mapIndexed { index, label ->
            val ratio = ratios[index]
            val cumulative = if (index == weekNames.lastIndex) {
                totalSubjectSp
            } else {
                (totalSubjectSp * ratio).toInt().coerceAtLeast((index + 1) * 8)
            }
            val weekSp = if (index == 0) cumulative else (cumulative - prevSp).coerceAtLeast(5)
            val growth = if (index == 0) 0f else {
                val prevWeekEarned = (cumulative - prevSp).coerceAtLeast(1)
                ((weekSp.toFloat() / prevWeekEarned) * 10f).coerceIn(5f, 75f)
            }
            prevSp = cumulative

            WeeklyTrendPoint(
                weekLabel = label,
                shortLabel = "W${34 + index}",
                weekNumber = index + 1,
                weeklySp = weekSp,
                cumulativeSp = cumulative,
                percentageGrowth = growth
            )
        }
    }

    /**
     * Calculates the student's earned academic achievements, badge unlocks,
     * and progression meters based on live user profile data.
     */
    fun getAchievements(): List<UserAchievement> {
        val totalSp = spPoints
        val physicsSp = subjectSp["Physics"] ?: (totalSp / 3).coerceAtLeast(15)
        val mathsSp = subjectSp["Combined Mathematics"] ?: (totalSp / 3).coerceAtLeast(15)
        val chemSp = subjectSp["Chemistry"] ?: (totalSp / 4).coerceAtLeast(10)
        val bioSp = subjectSp["Biology"] ?: (totalSp / 4).coerceAtLeast(10)

        return listOf(
            UserAchievement(
                id = "first_sp",
                title = "First Steps to Science",
                description = "Earn your first 25 Science Points across Zahira study modules",
                category = "Dedication",
                iconEmoji = "🌱",
                currentProgress = totalSp.coerceAtMost(25),
                maxProgress = 25,
                isUnlocked = totalSp >= 25,
                spReward = 10,
                unlockedDate = if (totalSp >= 25) "Term Start" else null
            ),
            UserAchievement(
                id = "physics_pioneer",
                title = "Physics Pioneer",
                description = "Attain 50+ Science Points in Advanced Level Physics questions",
                category = "Academic",
                iconEmoji = "⚛️",
                currentProgress = physicsSp.coerceAtMost(50),
                maxProgress = 50,
                isUnlocked = physicsSp >= 50,
                spReward = 25,
                unlockedDate = if (physicsSp >= 50) "Week 2" else null
            ),
            UserAchievement(
                id = "maths_prodigy",
                title = "Combined Maths Prodigy",
                description = "Accumulate 50+ Science Points in Pure & Applied Mathematics",
                category = "Academic",
                iconEmoji = "📐",
                currentProgress = mathsSp.coerceAtMost(50),
                maxProgress = 50,
                isUnlocked = mathsSp >= 50,
                spReward = 25,
                unlockedDate = if (mathsSp >= 50) "Week 3" else null
            ),
            UserAchievement(
                id = "chemistry_alchemist",
                title = "Alchemist Supreme",
                description = "Reach 40+ Science Points in Physical & Organic Chemistry",
                category = "Academic",
                iconEmoji = "🧪",
                currentProgress = chemSp.coerceAtMost(40),
                maxProgress = 40,
                isUnlocked = chemSp >= 40,
                spReward = 20,
                unlockedDate = if (chemSp >= 40) "Week 3" else null
            ),
            UserAchievement(
                id = "bio_scholar",
                title = "Biosphere Scholar",
                description = "Achieve 40+ Science Points in G.C.E. A/L Biology modules",
                category = "Academic",
                iconEmoji = "🧬",
                currentProgress = bioSp.coerceAtMost(40),
                maxProgress = 40,
                isUnlocked = bioSp >= 40,
                spReward = 20,
                unlockedDate = if (bioSp >= 40) "Week 4" else null
            ),
            UserAchievement(
                id = "wednesday_contestant",
                title = "Wednesday Night Gladiator",
                description = "Participate in the school live Wednesday Quiz (6:00 PM - 12:00 AM)",
                category = "Contests",
                iconEmoji = "⚡",
                currentProgress = if (weeklySp > 0 || hasEarlyQuizAccess) 1 else 0,
                maxProgress = 1,
                isUnlocked = weeklySp > 0 || hasEarlyQuizAccess,
                spReward = 30,
                unlockedDate = if (weeklySp > 0 || hasEarlyQuizAccess) "Active Week" else null
            ),
            UserAchievement(
                id = "milestone_tier1",
                title = "Milestone Tier 1",
                description = "Reach Level 5 to unlock the first official Zahira Level Milestone",
                category = "Milestones",
                iconEmoji = "🏅",
                currentProgress = level.coerceAtMost(5),
                maxProgress = 5,
                isUnlocked = level >= 5,
                spReward = 50,
                unlockedDate = if (level >= 5) "Level 5 Reached" else null
            ),
            UserAchievement(
                id = "leaderboard_elite",
                title = "Top 10 Leaderboard Scholar",
                description = "Secure a top 10 weekly ranking across college science streams",
                category = "Contests",
                iconEmoji = "👑",
                currentProgress = if (weeklyRank != null && weeklyRank in 1..10) 1 else 0,
                maxProgress = 1,
                isUnlocked = weeklyRank != null && weeklyRank in 1..10,
                spReward = 75,
                unlockedDate = if (weeklyRank != null && weeklyRank in 1..10) "Rank #$weeklyRank" else null
            ),
            UserAchievement(
                id = "century_club",
                title = "Century Science Club",
                description = "Surpass 100 total Science Points in your academic journey",
                category = "Dedication",
                iconEmoji = "💯",
                currentProgress = totalSp.coerceAtMost(100),
                maxProgress = 100,
                isUnlocked = totalSp >= 100,
                spReward = 40,
                unlockedDate = if (totalSp >= 100) "Milestone Unlocked" else null
            ),
            UserAchievement(
                id = "grand_polymath",
                title = "Grand Science Polymath",
                description = "Attain an extraordinary achievement of 300+ Science Points",
                category = "Dedication",
                iconEmoji = "🌟",
                currentProgress = totalSp.coerceAtMost(300),
                maxProgress = 300,
                isUnlocked = totalSp >= 300,
                spReward = 100,
                unlockedDate = if (totalSp >= 300) "Honors Unlocked" else null
            )
        )
    }
}

data class UserAchievement(
    val id: String,
    val title: String,
    val description: String,
    val category: String, // "Academic", "Milestones", "Contests", "Dedication"
    val iconEmoji: String,
    val currentProgress: Int,
    val maxProgress: Int,
    val isUnlocked: Boolean,
    val spReward: Int,
    val unlockedDate: String? = null
)

data class WeeklyTrendPoint(
    val weekLabel: String,
    val shortLabel: String,
    val weekNumber: Int,
    val weeklySp: Int,
    val cumulativeSp: Int,
    val percentageGrowth: Float
)
