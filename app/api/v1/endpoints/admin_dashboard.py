from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends
from app.api.deps import get_current_admin
from app.models.user import User
from app.schemas.response import APIResponse
from app.services.analytics_service import analytics_service

router = APIRouter()


@router.get(
    "/overview",
    response_model=APIResponse[Dict[str, Any]],
)
async def get_dashboard_overview(
    admin: User = Depends(get_current_admin),
) -> Any:
    """
    Fetch comprehensive real-time Admin Operations Dashboard Overview.
    Includes active online counts, realtime orders summary, top used feature, and traffic metrics.
    """
    overview_data = await analytics_service.get_overview()
    return APIResponse(
        success=True,
        message="Real-time Admin Dashboard Overview retrieved successfully.",
        data=overview_data,
    )


@router.get(
    "/locations",
    response_model=APIResponse[List[Dict[str, Any]]],
)
async def get_realtime_locations(
    admin: User = Depends(get_current_admin),
) -> Any:
    """
    Fetch real-time GPS locations and online status of all Users (Customers) and Delivery Partners.
    Returns latitude, longitude, speed, current address, online state, and status.
    """
    locations = await analytics_service.get_live_locations()
    return APIResponse(
        success=True,
        message="Real-time User and Partner locations retrieved successfully.",
        data=locations,
    )


@router.get(
    "/realtime-orders",
    response_model=APIResponse[Dict[str, Any]],
)
async def get_realtime_orders(
    admin: User = Depends(get_current_admin),
) -> Any:
    """
    Fetch real-time active orders (Ringing within 1KM, Accepted, Assigned, Out for Delivery, Completed today).
    """
    orders_data = await analytics_service.get_realtime_orders()
    return APIResponse(
        success=True,
        message="Real-time active orders status retrieved successfully.",
        data=orders_data,
    )


@router.get(
    "/analytics/users-graph",
    response_model=APIResponse[Dict[str, Any]],
)
async def get_users_graph(
    admin: User = Depends(get_current_admin),
) -> Any:
    """
    Fetch time-series user growth & activity graph data for Admin panel charts.
    """
    graph_data = await analytics_service.get_users_graph()
    return APIResponse(
        success=True,
        message="User growth and activity graph data retrieved successfully.",
        data=graph_data,
    )


@router.get(
    "/analytics/traffic-graph",
    response_model=APIResponse[Dict[str, Any]],
)
async def get_traffic_graph(
    admin: User = Depends(get_current_admin),
) -> Any:
    """
    Fetch system API traffic volume and endpoint distribution graph data for Admin panel charts.
    """
    traffic_data = analytics_service.get_traffic_graph()
    return APIResponse(
        success=True,
        message="Traffic graph data retrieved successfully.",
        data=traffic_data,
    )


@router.get(
    "/analytics/feature-usage",
    response_model=APIResponse[Dict[str, Any]],
)
async def get_feature_usage_analytics(
    admin: User = Depends(get_current_admin),
) -> Any:
    """
    Fetch detailed feature usage analytics showing 'what feature users are using more'.
    Provides usage counts, percentage breakdown, and ranking of most-used features across the platform.
    """
    usage_data = await analytics_service.get_feature_usage_analytics()
    return APIResponse(
        success=True,
        message="Feature usage analytics retrieved successfully.",
        data=usage_data,
    )
