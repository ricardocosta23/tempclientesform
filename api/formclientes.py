import os
import json
import logging
from flask import Blueprint, request, jsonify
from utils.monday_api import MondayAPI
from utils.form_generator import FormGenerator

formclientes_bp = Blueprint('formclientes', __name__)

@formclientes_bp.route('/formclientes', methods=['POST'])
def handle_formclientes():
    """Handle webhook for Clientes forms"""
    try:
        # Get webhook data
        data = request.get_json()
        
        # Handle Monday.com webhook challenge validation
        if data and 'challenge' in data:
            challenge = data['challenge']
            return jsonify({'challenge': challenge})
        
        webhook_data = data
        logging.info(f"Received webhook data for Clientes: {webhook_data}")
        
        # Load configuration
        with open('setup/config.json', 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        clientes_config = config.get('clientes', {})
        
        if not clientes_config.get('questions'):
            return jsonify({"error": "No questions configured for Clientes"}), 400
        
        # Initialize Monday.com API
        monday_api = MondayAPI()
        
        # Fetch header data from Monday.com with specific columns
        header_data = {}
        if clientes_config.get('board_a'):
            try:
                # Extract item ID from webhook data
                item_id = webhook_data.get('event', {}).get('pulseId')
                if item_id:
                    # Get specific item data from Monday.com
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

        # Process questions and populate Monday column data
        processed_questions = []
        for question in clientes_config['questions']:
            processed_question = question.copy()
            
            # If it's a Monday column question, fetch the data
            if question.get('type') == 'monday_column' and question.get('source_column'):
                try:
                    # Extract item ID from webhook data
                    item_id = webhook_data.get('event', {}).get('pulseId')
                    source_column = question.get('source_column')
                    
                    logging.info(f"Clientes - Fetching Monday column data - Item ID: {item_id}, Column: {source_column}, Board: {clientes_config['board_a']}")
                    
                    if item_id and source_column and clientes_config.get('board_a'):
                        try:
                            # Get specific item data from Monday.com
                            item_data = monday_api.get_item_column_values(item_id)
                            
                            logging.info(f"Clientes - Item data received: {item_data is not None}")
                            if item_data:
                                logging.info(f"Clientes - Item columns: {[col.get('id') for col in item_data.get('column_values', [])]}")

                            if item_data and item_data.get('column_values'):
                                # Find column value
                                column_value = ""
                                for column in item_data.get('column_values', []):
                                    logging.info(f"Clientes - Checking column: {column.get('id')} vs {source_column}")
                                    if column.get('id') == source_column:
                                        column_value = monday_api.get_column_value(column)
                                        logging.info(f"Clientes - Found column value: '{column_value}' from column data: {column}")
                                        break
                                
                                # Always set column_value, even if empty
                                processed_question['column_value'] = column_value if column_value else ""
                                logging.info(f"Clientes - Set column_value to: '{processed_question['column_value']}'")
                                
                                # Ensure destination_column is set for Monday column questions
                                if not processed_question.get('destination_column'):
                                    processed_question['destination_column'] = source_column
                                    logging.info(f"Clientes - Set destination_column to: '{source_column}'")
                            else:
                                logging.warning("Clientes - No item data or column values received from Monday.com")
                                processed_question['column_value'] = ""
                        except Exception as api_error:
                            logging.error(f"Clientes - Monday.com API error: {str(api_error)}")
                            processed_question['column_value'] = ""
                    else:
                        logging.warning(f"Clientes - Missing required data - item_id: {item_id}, source_column: {source_column}, board_a: {clientes_config.get('board_a')}")
                        processed_question['column_value'] = ""
                except Exception as e:
                    logging.error(f"Clientes - Error fetching Monday column data: {str(e)}")
                    processed_question['column_value'] = ""
            
            processed_questions.append(processed_question)

        # Generate form
        form_generator = FormGenerator()
        form_data = {
            "type": "clientes",
            "title": "Formulário de Avaliação - Clientes",
            "subtitle": "Avalie nossa experiência como cliente",
            "questions": processed_questions,
            "header_data": header_data,
            "webhook_data": webhook_data
        }
        
        form_id = form_generator.generate_form(form_data)
        form_url = f"{request.host_url}form/{form_id}"
        
        # Update Monday.com board if configured
        # Use board_a (source board) for the form link, since that's where the webhook originates
        if clientes_config.get('board_a') and clientes_config.get('link_column'):
            try:
                # Extract item ID from webhook data
                item_id = webhook_data.get('event', {}).get('pulseId')
                board_id = webhook_data.get('event', {}).get('boardId')
                if item_id and board_id:
                    monday_api.update_item_column(
                        board_id=board_id,  # Use the board ID from webhook
                        item_id=item_id,
                        column_id=clientes_config['link_column'],
                        value=form_url
                    )
                    logging.info(f"Updated Monday.com board {board_id} with form URL")
            except Exception as e:
                logging.error(f"Failed to update Monday.com: {str(e)}")
        
        return jsonify({
            "success": True,
            "form_url": form_url,
            "form_id": form_id,
            "message": "Form generated successfully for Clientes"
        })
        
    except Exception as e:
        logging.error(f"Error handling Clientes webhook: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500
import os
import json
import logging
from flask import Blueprint, request, jsonify
from utils.monday_api import MondayAPI
from utils.form_generator import FormGenerator

formclientes_bp = Blueprint('formclientes', __name__)

@formclientes_bp.route('/formclientes', methods=['POST'])
def handle_clientes_webhook():
    """Handle Monday.com webhook for Clientes forms"""
    try:
        webhook_data = request.get_json()
        logging.info(f"Received Clientes webhook: {webhook_data}")
        
        # Load configuration
        with open('setup/config.json', 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        clientes_config = config.get('clientes', {})
        
        if not clientes_config.get('board_a') or not clientes_config.get('questions'):
            return jsonify({"error": "Clientes configuration not complete"}), 400
        
        # Extract webhook information
        event = webhook_data.get('event', {})
        item_id = event.get('pulseId')
        item_name = event.get('pulseName', 'Cliente')
        
        if not item_id:
            return jsonify({"error": "Item ID not found in webhook"}), 400
        
        # Generate form
        form_generator = FormGenerator()
        
        # Prepare form data
        form_data = {
            "type": "clientes",
            "title": f"Avaliação de Cliente - {item_name}",
            "subtitle": "Por favor, preencha este formulário para avaliar o cliente",
            "questions": clientes_config.get('questions', []),
            "webhook_data": webhook_data,
            "item_id": item_id,
            "item_name": item_name
        }
        
        # Get Monday.com data if needed
        monday_api = MondayAPI()
        if monday_api.api_token:
            item_data = monday_api.get_item_column_values(item_id)
            if item_data and 'data' in item_data:
                # Add column values to form questions
                for question in form_data['questions']:
                    if question.get('type') == 'monday_column':
                        source_column = question.get('source_column')
                        if source_column and item_data['data']['items']:
                            for column_value in item_data['data']['items'][0]['column_values']:
                                if column_value['id'] == source_column:
                                    question['column_value'] = column_value['text']
                                    break
        
        form_id = form_generator.generate_form(form_data)
        
        # Generate form URL
        form_url = f"{request.host_url}form/{form_id}"
        
        # Update Monday.com with form link if configured
        if clientes_config.get('board_b') and clientes_config.get('link_column'):
            try:
                monday_api.update_item_column(
                    board_id=clientes_config['board_b'],
                    item_id=item_id,
                    column_id=clientes_config['link_column'],
                    value=form_url
                )
                logging.info(f"Updated Monday.com with form link: {form_url}")
            except Exception as e:
                logging.error(f"Failed to update Monday.com: {str(e)}")
        
        return jsonify({
            "message": "Clientes form generated successfully",
            "form_id": form_id,
            "form_url": form_url
        })
        
    except Exception as e:
        logging.error(f"Error processing Clientes webhook: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500
