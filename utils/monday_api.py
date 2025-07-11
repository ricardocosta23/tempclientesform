import os
import requests
import json
import logging

class MondayAPI:
    """Monday.com API integration utilities"""

    def __init__(self):
        self.api_token = "eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjQxMDM1MDMyNiwiYWFpIjoxMSwidWlkIjo1NTIyMDQ0LCJpYWQiOiIyMDI0LTA5LTEzVDExOjUyOjQzLjAwMFoiLCJwZXIiOiJtZTp3cml0ZSIsImFjdGlkIjozNzk1MywicmduIjoidXNlMSJ9.hwTlwMwtbhKdZsYcGT7UoENBLZUAxnfUXchj5RZJBz4"
        self.api_url = "https://api.monday.com/v2"
        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }

    def execute_query(self, query, variables=None):
        """Execute GraphQL query to Monday.com API"""
        try:
            payload = {
                "query": query,
                "variables": variables or {}
            }

            response = requests.post(
                self.api_url,
                json=payload,
                headers=self.headers,
                timeout=30
            )

            response.raise_for_status()
            result = response.json()

            if "errors" in result:
                logging.error(f"Monday.com API errors: {result['errors']}")
                raise Exception(f"API errors: {result['errors']}")

            return result.get("data")

        except requests.exceptions.RequestException as e:
            logging.error(f"Monday.com API request failed: {str(e)}")
            raise Exception(f"API request failed: {str(e)}")

    def get_board_columns(self, board_id):
        """Get all columns from a Monday.com board"""
        query = """
        query GetBoardColumns($boardId: ID!) {
            boards(ids: [$boardId]) {
                columns {
                    id
                    title
                    type
                }
            }
        }
        """

        variables = {"boardId": board_id}
        result = self.execute_query(query, variables)

        if result and result.get("boards"):
            return result["boards"][0].get("columns", [])
        return []

    def get_board_items(self, board_id, limit=50):
        """Get items from a Monday.com board"""
        query = """
        query GetBoardItems($boardId: ID!, $limit: Int) {
            boards(ids: [$boardId]) {
                items(limit: $limit) {
                    id
                    name
                    column_values {
                        id
                        text
                        value
                    }
                }
            }
        }
        """

        variables = {"boardId": str(board_id), "limit": limit}
        result = self.execute_query(query, variables)

        if result and result.get("boards") and len(result["boards"]) > 0:
            return result["boards"][0].get("items", [])
        return []

    def get_item_by_id(self, board_id, item_id):
        """Get a specific item by ID from a Monday.com board"""
        query = """
        query ($boardId: ID!, $itemId: ID!) {
            items(ids: [$itemId]) {
                id
                name
                board {
                    id
                }
                column_values {
                    id
                    text
                    value
                    type
                    ... on MirrorValue {
                        display_value
                    }
                }
            }
        }
        """

        variables = {"boardId": str(board_id), "itemId": str(item_id)}
        result = self.execute_query(query, variables)

        if result and result.get("items") and len(result["items"]) > 0:
            item = result["items"][0]
            # Verify the item belongs to the correct board
            if item.get("board", {}).get("id") == str(board_id):
                return item
        return None

    def get_item_column_values(self, item_id):
        """Get column values for a specific item"""
        query = """
        query ($itemId: ID!) {
            items(ids: [$itemId]) {
                id
                name
                column_values {
                    id
                    text
                    value
                    type
                    ... on MirrorValue {
                        display_value
                    }
                }
            }
        }
        """

        variables = {"itemId": str(item_id)}
        result = self.execute_query(query, variables)

        if result and result.get("items") and len(result["items"]) > 0:
            return result["items"][0]
        return None

    def get_column_value(self, column_data):
        """Extract the correct value from a column, handling mirror columns"""
        if not column_data:
            logging.warning("No column data provided")
            return ""

        logging.info(f"Processing column data: {column_data}")

        # For mirror columns, use display_value if available
        if column_data.get('display_value'):
            value = str(column_data['display_value']).strip()
            logging.info(f"Using display_value: '{value}'")
            return value

        # For text columns, use text value
        if column_data.get('text'):
            value = str(column_data['text']).strip()
            logging.info(f"Using text value: '{value}'")
            return value

        # For other column types, try to extract from value
        value = column_data.get('value')
        if value:
            try:
                # Try to parse JSON value
                import json
                parsed_value = json.loads(value) if isinstance(value, str) else value
                logging.info(f"Parsed JSON value: {parsed_value}")

                if isinstance(parsed_value, dict):
                    # Look for common value fields
                    if 'text' in parsed_value:
                        result = str(parsed_value['text']).strip()
                        logging.info(f"Using parsed text: '{result}'")
                        return result
                    elif 'label' in parsed_value:
                        result = str(parsed_value['label']).strip()
                        logging.info(f"Using parsed label: '{result}'")
                        return result

                result = str(parsed_value).strip()
                logging.info(f"Using stringified parsed value: '{result}'")
                return result
            except Exception as e:
                logging.error(f"Error parsing JSON value: {e}")
                result = str(value).strip()
                logging.info(f"Using raw value: '{result}'")
                return result

        logging.warning("No value found in column data")
        return ""

    def update_item_column(self, board_id, item_id, column_id, value):
        """Update a specific column value for an item"""
        # Get column type to determine proper formatting and mutation
        try:
            columns = self.get_board_columns(board_id)
            column_type = None
            for col in columns:
                if col['id'] == column_id:
                    column_type = col['type']
                    break

            logging.info(f"Column {column_id} type: {column_type}")

            # Format value based on column type
            if column_type == 'long_text':
                # For long text columns, use simple string format as per Monday.com API docs
                formatted_value = str(value)
            elif column_type == 'text':
                # For regular text columns, use JSON format
                formatted_value = json.dumps(str(value))
            else:
                # For other column types, preserve original formatting
                if isinstance(value, str):
                    formatted_value = json.dumps(value)
                else:
                    formatted_value = json.dumps(str(value))

            # Use different mutation for long text columns
            if column_type == 'long_text':
                query = """
                mutation UpdateItemColumn($boardId: ID!, $itemId: ID!, $columnId: String!, $value: String!) {
                    change_simple_column_value(
                        board_id: $boardId,
                        item_id: $itemId,
                        column_id: $columnId,
                        value: $value
                    ) {
                        id
                    }
                }
                """

                variables = {
                    "boardId": board_id,
                    "itemId": item_id,
                    "columnId": column_id,
                    "value": formatted_value
                }
            else:
                query = """
                mutation UpdateItemColumn($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
                    change_column_value(
                        board_id: $boardId,
                        item_id: $itemId,
                        column_id: $columnId,
                        value: $value
                    ) {
                        id
                    }
                }
                """

                variables = {
                    "boardId": board_id,
                    "itemId": item_id,
                    "columnId": column_id,
                    "value": formatted_value
                }

            result = self.execute_query(query, variables)
            logging.info(f"Updated column {column_id} for item {item_id} in board {board_id} with value: {value}")
            return result

        except Exception as e:
            logging.error(f"Error getting column type: {e}")
            # Fallback to regular mutation with JSON formatting
            formatted_value = json.dumps(str(value))

            query = """
            mutation UpdateItemColumn($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
                change_column_value(
                    board_id: $boardId,
                    item_id: $itemId,
                    column_id: $columnId,
                    value: $value
                ) {
                    id
                }
            }
            """

            variables = {
                "boardId": board_id,
                "itemId": item_id,
                "columnId": column_id,
                "value": formatted_value
            }

        result = self.execute_query(query, variables)
        logging.info(f"Updated column {column_id} for item {item_id} in board {board_id} with value: {value}")
        return result

    def create_item(self, board_id, item_name, column_values=None):
        """Create a new item in a Monday.com board"""
        query = """
        mutation CreateItem($boardId: ID!, $itemName: String!, $columnValues: JSON) {
            create_item(
                board_id: $boardId,
                item_name: $itemName,
                column_values: $columnValues
            ) {
                id
                name
            }
        }
        """

        variables = {
            "boardId": board_id,
            "itemName": item_name,
            "columnValues": json.dumps(column_values) if column_values else None
        }

        result = self.execute_query(query, variables)
        logging.info(f"Created new item '{item_name}' in board {board_id}")
        return result