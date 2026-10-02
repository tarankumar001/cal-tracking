package com.caltrack.app

import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.permission.PermissionController
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.time.LocalDate
import java.time.Period
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {
    private val stepsPermission = HealthPermission.getReadPermission(StepsRecord::class)
    private var pendingPermissionCall: PluginCall? = null
    private lateinit var permissionLauncher: ActivityResultLauncher<Set<String>>

    override fun load() {
        permissionLauncher = bridge.registerForActivityResult(
            PermissionController.createRequestPermissionResultContract()
        ) { granted ->
            val call = pendingPermissionCall ?: return@registerForActivityResult
            pendingPermissionCall = null
            call.resolve(JSObject().apply { put("connected", granted.contains(stepsPermission)) })
        }
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val sdkStatus = HealthConnectClient.getSdkStatus(context, HEALTH_CONNECT_PACKAGE)
        val available = sdkStatus == HealthConnectClient.SDK_AVAILABLE
        if (!available) {
            call.resolve(statusResult(false, false, "Health Connect is unavailable or needs an update."))
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val granted = HealthConnectClient.getOrCreate(context).permissionController.getGrantedPermissions()
                val connected = granted.contains(stepsPermission)
                call.resolve(statusResult(true, connected, if (connected) "Connected to Health Connect." else "Permission not granted."))
            } catch (error: Exception) {
                call.resolve(statusResult(false, false, "Health Connect could not be checked."))
            }
        }
    }

    @PluginMethod
    fun requestStepsPermission(call: PluginCall) {
        if (HealthConnectClient.getSdkStatus(context, HEALTH_CONNECT_PACKAGE) != HealthConnectClient.SDK_AVAILABLE) {
            call.resolve(statusResult(false, false, "Health Connect is unavailable or needs an update."))
            return
        }
        pendingPermissionCall = call
        permissionLauncher.launch(setOf(stepsPermission))
    }

    @PluginMethod
    fun readDailySteps(call: PluginCall) {
        val startDate = call.getString("startDate")
        val endDate = call.getString("endDate")
        if (startDate == null || endDate == null) {
            call.reject("A start date and end date are required.")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val granted = client.permissionController.getGrantedPermissions()
                if (!granted.contains(stepsPermission)) {
                    call.reject("Health Connect step permission has not been granted.")
                    return@launch
                }
                val start = LocalDate.parse(startDate)
                val end = LocalDate.parse(endDate).plusDays(1)
                val buckets = client.aggregateGroupByPeriod(
                    AggregateGroupByPeriodRequest(
                        metrics = setOf(StepsRecord.COUNT_TOTAL),
                        timeRangeFilter = TimeRangeFilter.between(start.atStartOfDay(), end.atStartOfDay()),
                        timeRangeSlicer = Period.ofDays(1)
                    )
                )
                val records = JSArray()
                buckets.forEach { bucket ->
                    records.put(JSObject().apply {
                        put("date", bucket.startTime.toLocalDate().toString())
                        put("steps", bucket.result[StepsRecord.COUNT_TOTAL] ?: 0L)
                        put("source", "health-connect")
                    })
                }
                call.resolve(JSObject().apply { put("records", records) })
            } catch (error: Exception) {
                call.reject("Health Connect could not read step data.", error)
            }
        }
    }

    private fun statusResult(available: Boolean, connected: Boolean, message: String) = JSObject().apply {
        put("available", available)
        put("connected", connected)
        put("message", message)
    }

    companion object {
        private const val HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata"
    }
}