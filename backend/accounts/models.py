"""
Accounts uses Django's built-in ``auth.User`` model (email as username) plus
DRF's ``authtoken.Token``. No additional models are required here; account
logic lives in ``accounts/services.py``.
"""
