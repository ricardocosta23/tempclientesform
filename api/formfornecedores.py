import os
import json
import logging
from flask import Blueprint, request, jsonify
from utils.monday_api import MondayAPI
from utils.form_generator import FormGenerator

formfornecedores_bp = Blueprint('formfornecedores', __name__)

@formfornecedores_bp.route('/formfornecedores', methods=['POST'])
def handle_fornecedores_webhook():
    """Handle Monday.com webhook for Fornecedores forms"""
    try:
        # Get webhook data
        data = request.get_json()

        # Handle Monday.com webhook challenge validation
        if data and 'challenge' in data:
            challenge = data['challenge']
            return jsonify({'challenge': challenge})

        webhook_data = data
        logging.info(f"Received Fornecedores webhook: {webhook_data}")

        # Load configuration
        with open('setup/config.json', 'r', encoding='utf-8') as f:
            config = json.load(f)

        fornecedores_config = config.get('fornecedores', {})

        if not fornecedores_config.get('board_a') or not fornecedores_config.get('questions'):
            return jsonify({"error": "Fornecedores configuration not complete"}), 400

        # Extract webhook information
        event = webhook_data.get('event', {})
        item_id = event.get('pulseId')
        item_name = event.get('pulseName', 'Fornecedor')

        if not item_id:
            return jsonify({"error": "Item ID not found in webhook"}), 400

        # Generate form
        form_generator = FormGenerator()

        # Prepare form data
        form_data = {
            "type": "fornecedores",
            "title": f"Avaliação de Fornecedor - {item_name}",
            "subtitle": "Por favor, preencha este formulário para avaliar o fornecedor",
            "questions": fornecedores_config.get('questions', []),
            "webhook_data": webhook_data,
            "item_id": item_id,
            "item_name": item_name
        }

        # Get Monday.com data if needed
        monday_api = MondayAPI()

        # Fetch header data from Monday.com with specific columns
        header_data = {}
        if fornecedores_config.get('board_a'):
            try:
                # Get specific item data from Monday.com using the working method
                item_data = monday_api.get_item_column_values(item_id)

                if item_data:
                    # Set Viagem as the item name
                    header_data['Viagem'] = item_data.get('name', '')

                    # Map specific columns to header fields
                    column_mapping = {
                        'lookup_mkrjh91x': 'Destino',
                        'lookup_mkrjpdz0': 'Data',
                        'lookup_mkrb9ns5': 'Cliente'
                    }

                    # Extract column values
                    for column in item_data.get('column_values', []):
                        column_id = column.get('id')
                        if column_id in column_mapping:
                            header_field = column_mapping[column_id]
                            column_value = monday_api.get_column_value(column)
                            if column_value:
                                header_data[header_field] = column_value

                    logging.info(f"Header data collected: {header_data}")
            except Exception as e:
                logging.error(f"Error fetching header data: {str(e)}")

        # Add header data to form
        form_data['header_data'] = header_data

        # Process questions and add Monday column data
        if monday_api.api_token:
            try:
                item_data = monday_api.get_item_by_id(fornecedores_config['board_a'], item_id)
                if item_data:
                    # Add column values to form questions
                    for question in form_data['questions']:
                        if question.get('type') == 'monday_column':
                            source_column = question.get('source_column')
                            if source_column:
                                # Find column value
                                column_value = ""
                                for column in item_data.get('column_values', []):
                                    if column.get('id') == source_column:
                                        column_value = monday_api.get_column_value(column)
                                        break

                                # Always set column_value, even if empty
                                question['column_value'] = column_value if column_value else ""
                                
                                # Ensure destination_column is set for Monday column questions
                                if not question.get('destination_column'):
                                    question['destination_column'] = source_column
                                    logging.info(f"Fornecedores - Set destination_column to: '{source_column}'")
            except Exception as e:
                logging.error(f"Error fetching Monday column data: {str(e)}")

        form_id = form_generator.generate_form(form_data)

        # Generate form URL
        form_url = f"{request.host_url}form/{form_id}"

        # Update Monday.com with form link if configured
        if fornecedores_config.get('board_b') and fornecedores_config.get('link_column'):
            try:
                monday_api.update_item_column(
                    board_id=fornecedores_config['board_b'],
                    item_id=item_id,
                    column_id=fornecedores_config['link_column'],
                    value=form_url
                )
                logging.info(f"Updated Monday.com with form link: {form_url}")
            except Exception as e:
                logging.error(f"Failed to update Monday.com: {str(e)}")

        return jsonify({
            "message": "Fornecedores form generated successfully",
            "form_id": form_id,
            "form_url": form_url
        })

    except Exception as e:
        logging.error(f"Error processing Fornecedores webhook: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500