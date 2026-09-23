package com.example

import com.example.data.DataRepository
import com.example.model.AcademicStream
import com.example.model.LeaderboardTimeframe
import com.example.model.UserProfile
import com.example.model.UserRole
import org.junit.Assert.*
import org.junit.Test

class ExampleUnitTest {

    @Test
    fun testWeekKeyFormat() {
        val weekKey = DataRepository.getCurrentWeekKey()
        assertTrue(weekKey.matches(Regex("""\d{4}-W\d{2}""")))
    }

    @Test
    fun testNormalizeSubject() {
        assertEquals("Combined Mathematics", DataRepository.normalizeSubject("maths"))
        assertEquals("Combined Mathematics", DataRepository.normalizeSubject("Combined Mathematics"))
        assertEquals("Physics", DataRepository.normalizeSubject("physics"))
        assertEquals("Chemistry", DataRepository.normalizeSubject("Chemistry"))
        assertEquals("Biology", DataRepository.normalizeSubject("bio"))
        assertEquals("ICT", DataRepository.normalizeSubject("ict"))
    }

    @Test
    fun testAllTimeAndWeeklyLeaderboardSeparation() {
        val currentWeek = DataRepository.getCurrentWeekKey()
        val allTimeOverall = DataRepository.getLeaderboard(LeaderboardTimeframe.ALL_TIME, "Overall")
        assertNotNull(allTimeOverall)
        assertTrue(allTimeOverall.isNotEmpty())

        // Top rank in all-time should have highest points
        for (i in 0 until allTimeOverall.size - 1) {
            assertTrue(allTimeOverall[i].score >= allTimeOverall[i + 1].score)
        }

        // Weekly leaderboard only includes points for active week
        val weeklyOverall = DataRepository.getLeaderboard(LeaderboardTimeframe.WEEKLY, "Overall")
        assertNotNull(weeklyOverall)
        for (entry in weeklyOverall) {
            assertTrue(entry.score > 0)
        }

        // Subject-specific all-time
        val physicsAllTime = DataRepository.getLeaderboard(LeaderboardTimeframe.ALL_TIME, "Physics")
        assertNotNull(physicsAllTime)
        assertTrue(physicsAllTime.isNotEmpty())
        assertEquals("Physics", physicsAllTime.first().subjectName)
    }

    @Test
    fun testWeeklySpTrendPoints() {
        val testUser = UserProfile(
            id = "test_student",
            email = "student@zahira.lk",
            fullName = "Test Student",
            role = UserRole.STUDENT,
            stream = AcademicStream.PHYSICAL_SCIENCE,
            spPoints = 400,
            weeklySp = 80,
            subjectSp = mapOf("Physics" to 200, "Combined Mathematics" to 200),
            weeklySubjectSp = mapOf("Physics" to 40, "Combined Mathematics" to 40)
        )

        val overallTrend = testUser.getWeeklySpTrendPoints("Overall")
        assertEquals(6, overallTrend.size)
        // Last point cumulative should equal student's spPoints
        assertEquals(400, overallTrend.last().cumulativeSp)
        assertTrue(overallTrend.last().weeklySp > 0)

        // Monotonically non-decreasing cumulative SP
        for (i in 0 until overallTrend.size - 1) {
            assertTrue(overallTrend[i].cumulativeSp <= overallTrend[i + 1].cumulativeSp)
        }

        // Subject-specific trend
        val physicsTrend = testUser.getWeeklySpTrendPoints("Physics")
        assertEquals(6, physicsTrend.size)
        assertEquals(200, physicsTrend.last().cumulativeSp)
    }

    @Test
    fun testAchievementsCalculation() {
        val testUser = UserProfile(
            id = "test_student",
            email = "student@zahira.lk",
            fullName = "Test Student",
            role = UserRole.STUDENT,
            stream = AcademicStream.PHYSICAL_SCIENCE,
            spPoints = 350,
            level = 6,
            weeklySp = 70,
            weeklyRank = 3,
            subjectSp = mapOf(
                "Physics" to 120,
                "Combined Mathematics" to 110,
                "Chemistry" to 60,
                "Biology" to 60
            )
        )

        val achievements = testUser.getAchievements()
        assertTrue(achievements.isNotEmpty())

        val physicsBadge = requireNotNull(achievements.find { it.id == "physics_pioneer" })
        assertTrue(physicsBadge.isUnlocked)
        assertEquals(50, physicsBadge.currentProgress)

        val milestoneBadge = requireNotNull(achievements.find { it.id == "milestone_tier1" })
        assertTrue(milestoneBadge.isUnlocked)

        val rankBadge = requireNotNull(achievements.find { it.id == "leaderboard_elite" })
        assertTrue(rankBadge.isUnlocked)

        val polymathBadge = requireNotNull(achievements.find { it.id == "grand_polymath" })
        assertTrue(polymathBadge.isUnlocked) // 350 >= 300
    }
}
