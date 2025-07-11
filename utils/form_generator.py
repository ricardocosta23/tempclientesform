
import uuid
import json
from datetime import datetime
from flask import current_app
import logging

class FormGenerator:
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def generate_form(self, form_data):
        """Generate a new form and store it in memory"""
        form_id = str(uuid.uuid4())

        # Create complete form data structure
        complete_form_data = {
            "id": form_id,
            "type": form_data.get("type"),
            "title": form_data.get("title"),
            "subtitle": form_data.get("subtitle"),
            "questions": form_data.get("questions", []),
            "webhook_data": form_data.get("webhook_data", {}),
            "header_data": form_data.get("header_data", {}),
            "created_at": datetime.now().isoformat()
        }

        # Store in memory using the app's store function
        if hasattr(current_app, 'store_form_data'):
            current_app.store_form_data(form_id, complete_form_data)

        self.logger.info(f"Generated form {form_id} for type {form_data.get('type')}")
        return form_id

    def get_form_data(self, form_id):
        """Get form data from memory"""
        if hasattr(current_app, 'get_form_data'):
            return current_app.get_form_data(form_id)
        return None

    def list_all_forms(self):
        """List all forms (for admin interface)"""
        forms = []
        if hasattr(current_app, 'FORMS_STORAGE'):
            for form_id, form_data in current_app.FORMS_STORAGE.items():
                forms.append({
                    'id': form_id,
                    'type': form_data.get('type', 'unknown'),
                    'created_at': form_data.get('created_at', ''),
                    'header_data': form_data.get('header_data', {})
                })
        return forms

    def delete_form(self, form_id):
        """Delete a form from memory"""
        if hasattr(current_app, 'FORMS_STORAGE') and form_id in current_app.FORMS_STORAGE:
            del current_app.FORMS_STORAGE[form_id]
            return True
        return False
